import React, { useState, useEffect, useRef } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { awsConfig } from '../aws-config';
import './DraftRoom.css';

const SLEEPER_API = 'https://api.sleeper.app/v1';

function FPLCommandCenter({ user, onBack }) {
  const [leagueId, setLeagueId] = useState(localStorage.getItem('fplLeagueId') || '');
  const [sleeperUserId, setSleeperUserId] = useState(localStorage.getItem('fplSleeperUserId') || '');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState(null);
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [players, setPlayers] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('lineup');

  useEffect(() => {
    // Load cached analysis
    const cached = localStorage.getItem('fplAnalysis');
    if (cached) { try { setAnalysis(JSON.parse(cached)); } catch {} }
    // Auto-connect if we have saved IDs
    if (leagueId && sleeperUserId) autoConnect();
  }, []);

  async function autoConnect() {
    setLoading(true);
    try {
      const [playersData, league, rosters, users] = await Promise.all([
        fetch(`${SLEEPER_API}/players/clubsoccer:epl`).then(r => r.json()),
        fetch(`${SLEEPER_API}/league/${leagueId}`).then(r => r.json()),
        fetch(`${SLEEPER_API}/league/${leagueId}/rosters`).then(r => r.json()),
        fetch(`${SLEEPER_API}/league/${leagueId}/users`).then(r => r.json()),
      ]);
      setPlayers(playersData);
      setLeagueInfo({ ...league, users });
      const myRoster = rosters.find(r => r.owner_id === sleeperUserId);
      if (myRoster) {
        setRoster(buildRoster(myRoster, playersData, users, sleeperUserId));
        setConnected(true);
      } else {
        setError('Could not find your roster. Check your Sleeper User ID.');
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function buildRoster(rosterData, playersDb, users, userId) {
    const sleeperUser = users?.find(u => u.user_id === userId);
    const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || 'My Team';
    const posMap = { F: 'FWD', M: 'MID', D: 'DEF', GK: 'GK' };
    const rosterPlayers = (rosterData.players || []).map(pid => {
      const p = playersDb[pid];
      if (!p) return { playerId: pid, name: 'Unknown', position: '?', team: 'FA', status: 'healthy' };
      const pos = posMap[p.position] || p.position || '?';
      return { playerId: pid, name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(), position: pos, team: p.team_abbr || 'FA', status: p.injury_status || 'healthy', age: p.age };
    });
    const starterIds = rosterData.starters || [];
    return {
      teamName,
      players: rosterPlayers,
      starters: rosterPlayers.filter(p => starterIds.includes(p.playerId)),
      bench: rosterPlayers.filter(p => !starterIds.includes(p.playerId)),
      record: rosterData.settings ? `${rosterData.settings.wins || 0}-${rosterData.settings.losses || 0}` : 'N/A'
    };
  }

  async function connect() {
    if (!leagueId || !sleeperUserId) { setError('Both League ID and Sleeper Username required'); return; }
    setLoading(true);
    setError('');
    try {
      // Resolve username to user_id via Sleeper API
      let resolvedUserId = sleeperUserId;
      if (!/^\d+$/.test(sleeperUserId)) {
        // It's a username, not an ID — look it up
        const userRes = await fetch(`${SLEEPER_API}/user/${sleeperUserId}`);
        if (!userRes.ok) throw new Error(`Username "${sleeperUserId}" not found on Sleeper`);
        const userData = await userRes.json();
        if (!userData || !userData.user_id) throw new Error(`Could not resolve username "${sleeperUserId}"`);
        resolvedUserId = userData.user_id;
      }
      setSleeperUserId(resolvedUserId);
      localStorage.setItem('fplLeagueId', leagueId);
      localStorage.setItem('fplSleeperUserId', resolvedUserId);
      
      // Now connect with resolved ID
      const [playersData, league, rosters, users] = await Promise.all([
        fetch(`${SLEEPER_API}/players/clubsoccer:epl`).then(r => r.json()),
        fetch(`${SLEEPER_API}/league/${leagueId}`).then(r => r.json()),
        fetch(`${SLEEPER_API}/league/${leagueId}/rosters`).then(r => r.json()),
        fetch(`${SLEEPER_API}/league/${leagueId}/users`).then(r => r.json()),
      ]);
      setPlayers(playersData);
      setLeagueInfo({ ...league, users });
      const myRoster = rosters.find(r => r.owner_id === resolvedUserId);
      if (myRoster) {
        setRoster(buildRoster(myRoster, playersData, users, resolvedUserId));
        setConnected(true);
      } else {
        setError('Could not find your roster in this league. Make sure the username/ID matches your Sleeper account.');
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setError('');
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      // Try to use the existing analysis pipeline
      const res = await fetch(`${awsConfig.apiEndpoint}/analysis/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, sport: 'fpl' })
      });

      if (res.ok) {
        // Poll for results
        setTimeout(async () => {
          const analysisRes = await fetch(`${awsConfig.apiEndpoint}/analysis/latest`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (analysisRes.ok) {
            const data = await analysisRes.json();
            setAnalysis(data);
            localStorage.setItem('fplAnalysis', JSON.stringify(data));
          }
          setAnalyzing(false);
        }, 15000);
      } else {
        // Fallback: generate local analysis from roster data
        generateLocalAnalysis();
      }
    } catch (e) {
      // Fallback to local analysis
      generateLocalAnalysis();
    }
  }

  function generateLocalAnalysis() {
    if (!roster) { setAnalyzing(false); return; }
    
    // Generate basic analysis locally
    const starters = roster.starters;
    const bench = roster.bench;
    
    const recommendations = [];
    
    // Check for injured starters
    starters.forEach(p => {
      if (p.status && p.status !== 'healthy' && p.status !== 'Active') {
        const replacement = bench.find(b => b.position === p.position && (!b.status || b.status === 'healthy'));
        recommendations.push({
          type: 'injury',
          priority: 'high',
          icon: '🚨',
          title: `${p.name} — ${p.status}`,
          detail: replacement ? `Consider starting ${replacement.name} instead` : `No healthy ${p.position} on bench — check waivers`,
          action: replacement ? 'SWAP' : 'WAIVER'
        });
      }
    });

    // Bench players that might deserve starts (simple: lower-ranked bench vs starter)
    bench.filter(b => !b.status || b.status === 'healthy').forEach(b => {
      const samePosSt = starters.filter(s => s.position === b.position);
      // This is simplified — real analysis would use projections
      if (samePosSt.length > 0) {
        recommendations.push({
          type: 'consideration',
          priority: 'low',
          icon: '🤔',
          title: `${b.name} on bench`,
          detail: `Monitor form — could challenge for starting spot over ${samePosSt[samePosSt.length - 1].name}`,
          action: 'MONITOR'
        });
      }
    });

    // Waiver suggestions
    recommendations.push({
      type: 'waiver',
      priority: 'medium',
      icon: '📋',
      title: 'Check waiver wire',
      detail: 'Look for players with favorable upcoming fixtures who were recently dropped',
      action: 'WAIVERS'
    });

    const analysisResult = {
      recommendations: recommendations.slice(0, 8),
      grade: roster.starters.length >= 11 ? 'B+' : 'C',
      summary: `Squad has ${roster.starters.length} starters set. ${recommendations.filter(r => r.priority === 'high').length} urgent actions needed.`,
      lastUpdated: new Date().toISOString()
    };

    setAnalysis(analysisResult);
    localStorage.setItem('fplAnalysis', JSON.stringify(analysisResult));
    setAnalyzing(false);
  }

  // ========== CONNECT SCREEN ==========
  if (!connected) {
    return (
      <div className="draft-room">
        <div className="draft-connect">
          <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
          <h1>⚽ FPL Command Center</h1>
          <p className="subtitle">Connect your Sleeper FPL league for AI-powered gameweek analysis</p>
          
          <div className="connect-form">
            <div className="input-group">
              <label>Sleeper League ID</label>
              <input value={leagueId} onChange={e => setLeagueId(e.target.value)} placeholder="Your FPL league ID from Sleeper" />
              <span className="hint">Sleeper → League Settings → scroll to bottom</span>
            </div>
            <div className="input-group">
              <label>Your Sleeper Username</label>
              <input value={sleeperUserId} onChange={e => setSleeperUserId(e.target.value)} placeholder="Your Sleeper username (e.g., willledbetter)" />
              <span className="hint">Your display name on Sleeper — or numeric user ID if you have it</span>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="connect-btn" onClick={connect} disabled={loading}>
              {loading ? 'Connecting...' : '⚡ Connect League'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== COMMAND CENTER ==========
  return (
    <div className="draft-room">
      <div className="draft-header">
        <div className="draft-header-left">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>⚽ FPL Command Center</h1>
          {leagueInfo && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{leagueInfo.name}</span>}
        </div>
        <div className="draft-header-right">
          <span className="my-slot-badge">{roster?.teamName}</span>
          <span className="draft-info">{roster?.record}</span>
          <button className="connect-btn" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.8rem' }} onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? '⏳ Analyzing...' : '🧠 Run Analysis'}
          </button>
        </div>
      </div>

      <div className="draft-layout">
        {/* Main content */}
        <div className="draft-board-section">
          <div className="recs-tabs" style={{ marginBottom: 12 }}>
            <button className={activeTab === 'lineup' ? 'active' : ''} onClick={() => setActiveTab('lineup')}>Lineup</button>
            <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}>Analysis</button>
          </div>

          {activeTab === 'lineup' && roster && (
            <div>
              <h2 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 10 }}>Starting XI</h2>
              <div className="draft-picks-list">
                {roster.starters.map((p, i) => (
                  <div key={i} className="pick-row">
                    <span className="pick-num">{i + 1}</span>
                    <span className={`pick-pos pos-${(p.position || '').toLowerCase()}`}>{p.position}</span>
                    <span className="pick-player">{p.name}</span>
                    <span className="pick-team">{p.team}</span>
                    <span className="pick-drafter" style={{ color: p.status !== 'healthy' && p.status ? '#ef4444' : 'var(--text-muted)' }}>
                      {p.status !== 'healthy' && p.status ? `⚠️ ${p.status}` : '✓'}
                    </span>
                  </div>
                ))}
              </div>
              
              <h2 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '16px 0 10px' }}>Bench</h2>
              <div className="draft-picks-list">
                {roster.bench.map((p, i) => (
                  <div key={i} className="pick-row" style={{ opacity: 0.7 }}>
                    <span className="pick-num">BN</span>
                    <span className={`pick-pos pos-${(p.position || '').toLowerCase()}`}>{p.position}</span>
                    <span className="pick-player">{p.name}</span>
                    <span className="pick-team">{p.team}</span>
                    <span className="pick-drafter">{p.status !== 'healthy' && p.status ? `⚠️ ${p.status}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div>
              {!analysis ? (
                <div className="waiting-msg">
                  <p>No analysis yet. Hit "Run Analysis" to get AI-powered recommendations.</p>
                </div>
              ) : (
                <div>
                  <div className="strategy-box">
                    <strong>Summary:</strong> {analysis.summary}
                    {analysis.lastUpdated && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>Last updated: {new Date(analysis.lastUpdated).toLocaleString()}</div>}
                  </div>
                  <div className="recs-list">
                    {(analysis.recommendations || []).map((rec, i) => (
                      <div key={i} className={`rec-card ${rec.priority === 'high' ? 'top-pick' : ''}`}>
                        <div className="rec-header">
                          <span style={{ fontSize: '1rem' }}>{rec.icon || '📋'}</span>
                          <span className="rec-name">{rec.title}</span>
                        </div>
                        <div className="rec-reason">{rec.detail}</div>
                        {rec.action && <div className="rec-tag">{rec.action}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side panel - quick stats */}
        <div className="draft-recs-section">
          <div style={{ padding: 16 }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--gold)', marginBottom: 12 }}>Squad Overview</h3>
            {roster && (
              <div className="squad-counts">
                <h4>By Position</h4>
                {Object.entries(
                  roster.players.reduce((acc, p) => { acc[p.position] = (acc[p.position] || 0) + 1; return acc; }, {})
                ).sort((a, b) => b[1] - a[1]).map(([pos, count]) => (
                  <div key={pos} className="count-row">
                    <span className={`pos-${pos.toLowerCase()}`}>{pos}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            )}
            
            {roster && (
              <div className="squad-counts" style={{ marginTop: 12 }}>
                <h4>Health</h4>
                <div className="count-row">
                  <span>Healthy</span>
                  <span style={{ color: '#10b981' }}>{roster.players.filter(p => !p.status || p.status === 'healthy').length}</span>
                </div>
                <div className="count-row">
                  <span>Injured/Doubtful</span>
                  <span style={{ color: '#ef4444' }}>{roster.players.filter(p => p.status && p.status !== 'healthy').length}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-card-glass)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--gold)' }}>💡 Tip:</strong> Hit "Run Analysis" before gameweek deadline for start/sit recommendations and waiver targets.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FPLCommandCenter;
