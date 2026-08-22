import React, { useState, useEffect, useRef } from 'react';
import './DraftRoom.css';

const SLEEPER_API = 'https://api.sleeper.app/v1';

const STRATEGIES = {
  'hero-rb': {
    name: '🦸 Hero RB',
    desc: 'Lock in one elite RB early, then hammer WRs in rounds 2-5.',
    weights: { RB: [100,30,30,30,30,80,40,70,30,40], WR: [40,100,100,90,80,40,40,30,70,40], TE: [20,30,40,30,30,30,60,30,30,30], QB: [10,10,20,30,40,50,70,40,30,30] }
  },
  'zero-rb': {
    name: '🚫 Zero RB',
    desc: 'Load WRs/TE early. Grab RBs later for upside.',
    weights: { RB: [20,20,20,30,30,100,90,80,70,30], WR: [100,100,80,90,50,30,30,30,30,70], TE: [30,50,80,30,30,20,20,20,20,20], QB: [10,10,20,30,70,40,40,30,30,30] }
  },
  'robust-rb': {
    name: '💪 Robust RB',
    desc: 'Two RBs in first 3 rounds. Secure the scarce position.',
    weights: { RB: [100,90,70,30,30,30,30,30,70,30], WR: [30,40,60,100,90,70,40,80,30,70], TE: [20,20,30,30,40,70,40,30,30,30], QB: [10,10,20,30,40,50,70,40,30,30] }
  },
  'balanced': {
    name: '⚖️ Balanced BPA',
    desc: 'Best player available. Stay flexible, adapt to what falls.',
    weights: { RB: [70,70,60,60,50,50,40,40,40,40], WR: [70,70,60,60,50,50,40,40,40,40], TE: [40,40,50,40,40,40,40,30,30,30], QB: [30,30,40,50,50,50,50,40,30,30] }
  },
  'anchor-te': {
    name: '🎯 Anchor TE',
    desc: 'Lock a top-3 TE early. Build around the positional edge.',
    weights: { RB: [80,30,40,90,30,30,30,80,30,70], WR: [80,30,60,40,90,80,40,30,70,30], TE: [20,100,80,20,20,20,20,20,20,20], QB: [10,10,20,30,40,50,70,40,30,30] }
  }
};

function DraftRoom({ user, onBack }) {
  const [leagueId, setLeagueId] = useState(localStorage.getItem('nflDraftLeagueId') || '');
  const [draftId, setDraftId] = useState('');
  const [draft, setDraft] = useState(null);
  const [picks, setPicks] = useState([]);
  const [players, setPlayers] = useState(null);
  const [leagueUsers, setLeagueUsers] = useState([]);
  const [mySlot, setMySlot] = useState(parseInt(localStorage.getItem('nflDraftMySlot')) || null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strategy, setStrategy] = useState(localStorage.getItem('nflDraftStrategy') || 'balanced');
  const [recs, setRecs] = useState([]);
  const [mockMode, setMockMode] = useState(false);
  const [strategyNote, setStrategyNote] = useState('');
  const [activeTab, setActiveTab] = useState('recs');
  const [posFilter, setPosFilter] = useState('ALL');
  const pollRef = useRef(null);
  const prevCountRef = useRef(0);
  const draftIdRef = useRef(draftId);
  const picksLengthRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { draftIdRef.current = draftId; }, [draftId]);
  useEffect(() => { picksLengthRef.current = picks.length; }, [picks]);

  useEffect(() => {
    fetch(`${SLEEPER_API}/players/nfl`)
      .then(r => {
        if (!r.ok) throw new Error(`Players API returned ${r.status}`);
        return r.json();
      })
      .then(setPlayers)
      .catch(e => console.error('Failed to load players:', e));
  }, []);

  useEffect(() => {
    if (connected && draftId && !mockMode) {
      pollPicks();
      pollRef.current = setInterval(pollPicks, 3000);
      return () => clearInterval(pollRef.current);
    }
  }, [connected, draftId, mockMode]);

  useEffect(() => {
    if (picks.length !== prevCountRef.current) {
      prevCountRef.current = picks.length;
      generateRecs();
    }
  }, [picks, strategy, mySlot]);

  async function pollPicks() {
    const did = draftIdRef.current;
    if (!did) return;
    try {
      const data = await fetch(`${SLEEPER_API}/draft/${did}/picks`).then(r => r.json());
      if (Array.isArray(data) && data.length !== picksLengthRef.current) {
        setPicks(data);
      }
    } catch (e) { /* silent */ }
  }

  // ========== MOCK DRAFT MODE ==========
  function startMockDraft(numTeams = 12, numRounds = 15, slot = 1) {
    setMockMode(true);
    setMySlot(slot);
    localStorage.setItem('nflDraftMySlot', slot);
    setDraft({
      type: 'snake',
      settings: { teams: numTeams, rounds: numRounds, roster_positions: ['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF','BN','BN','BN','BN','BN'] },
      league_id: null
    });
    setPicks([]);
    setConnected(true);
    setDraftId('mock');
    draftIdRef.current = 'mock';
  }

  function mockSimulatePick() {
    if (!players || !draft) return;
    const numTeams = draft.settings.teams;
    const totalPicks = numTeams * (draft.settings.rounds || 15);
    if (picks.length >= totalPicks) return;

    const round = Math.floor(picks.length / numTeams) + 1;
    const pickInRound = picks.length % numTeams;
    let draftSlot;
    if (draft.type === 'snake') {
      draftSlot = round % 2 === 1 ? pickInRound + 1 : numTeams - pickInRound;
    } else {
      draftSlot = pickInRound + 1;
    }

    // If it's my turn, don't auto-pick
    if (draftSlot === mySlot) return;

    const taken = new Set(picks.map(p => p.player_id));
    const available = Object.entries(players)
      .filter(([id, p]) => !taken.has(id) && p.active && ['QB','RB','WR','TE','K','DEF'].includes(p.position) && p.team)
      .sort((a, b) => (a[1].search_rank || 9999) - (b[1].search_rank || 9999));

    if (available.length === 0) return;

    // Simulate some variance — pick from top 5 available with slight randomness
    const poolSize = Math.min(5, available.length);
    const pickIdx = Math.floor(Math.random() * poolSize);
    const [playerId] = available[pickIdx];

    const newPick = {
      player_id: playerId,
      round,
      pick_no: pickInRound + 1,
      draft_slot: draftSlot,
      picked_by: `mock_team_${draftSlot}`
    };
    setPicks(prev => [...prev, newPick]);
  }

  function mockMakePick(playerId) {
    if (!players || !draft) return;
    const numTeams = draft.settings.teams;
    const round = Math.floor(picks.length / numTeams) + 1;
    const pickInRound = picks.length % numTeams;
    let draftSlot;
    if (draft.type === 'snake') {
      draftSlot = round % 2 === 1 ? pickInRound + 1 : numTeams - pickInRound;
    } else {
      draftSlot = pickInRound + 1;
    }

    if (draftSlot !== mySlot) return; // Not my turn

    const newPick = {
      player_id: playerId,
      round,
      pick_no: pickInRound + 1,
      draft_slot: draftSlot,
      picked_by: 'me'
    };
    setPicks(prev => [...prev, newPick]);
  }

  function mockAutoAdvance() {
    // Simulate all picks until it's my turn (or draft ends)
    if (!players || !draft) return;
    const numTeams = draft.settings.teams;
    const totalPicks = numTeams * (draft.settings.rounds || 15);
    let currentPicks = [...picks];

    while (currentPicks.length < totalPicks) {
      const round = Math.floor(currentPicks.length / numTeams) + 1;
      const pickInRound = currentPicks.length % numTeams;
      let draftSlot;
      if (draft.type === 'snake') {
        draftSlot = round % 2 === 1 ? pickInRound + 1 : numTeams - pickInRound;
      } else {
        draftSlot = pickInRound + 1;
      }

      if (draftSlot === mySlot) break; // Stop when it's my turn

      const taken = new Set(currentPicks.map(p => p.player_id));
      const available = Object.entries(players)
        .filter(([id, p]) => !taken.has(id) && p.active && ['QB','RB','WR','TE','K','DEF'].includes(p.position) && p.team)
        .sort((a, b) => (a[1].search_rank || 9999) - (b[1].search_rank || 9999));

      if (available.length === 0) break;
      const poolSize = Math.min(5, available.length);
      const pickIdx = Math.floor(Math.random() * poolSize);
      const [playerId] = available[pickIdx];

      currentPicks.push({
        player_id: playerId,
        round,
        pick_no: pickInRound + 1,
        draft_slot: draftSlot,
        picked_by: `mock_team_${draftSlot}`
      });
    }
    setPicks(currentPicks);
  }

  async function connectToDraft() {
    setLoading(true); setError('');
    try {
      let did = draftId;
      if (leagueId && !did) {
        const resp = await fetch(`${SLEEPER_API}/league/${leagueId}/drafts`);
        if (!resp.ok) throw new Error(`League not found (${resp.status}). Check your League ID.`);
        const drafts = await resp.json();
        if (!drafts?.length) throw new Error('No drafts found for this league');
        const active = drafts.find(d => d.status === 'drafting') || drafts[0];
        did = active.draft_id;
        setDraftId(did);
      }
      if (!did) throw new Error('Provide a League ID or Draft ID');

      const draftResp = await fetch(`${SLEEPER_API}/draft/${did}`);
      if (!draftResp.ok) throw new Error(`Draft not found (${draftResp.status}). Check your Draft ID.`);
      const draftData = await draftResp.json();
      setDraft(draftData);

      const lid = draftData.league_id || leagueId;
      if (lid) {
        setLeagueId(lid);
        const usersResp = await fetch(`${SLEEPER_API}/league/${lid}/users`);
        const users = usersResp.ok ? await usersResp.json() : [];
        setLeagueUsers(users || []);
      }

      const picksResp = await fetch(`${SLEEPER_API}/draft/${did}/picks`);
      const picksData = picksResp.ok ? await picksResp.json() : [];
      setPicks(picksData || []);
      setConnected(true);
      localStorage.setItem('nflDraftLeagueId', lid || leagueId);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function getCurrentRound() { return draft ? Math.floor(picks.length / draft.settings.teams) + 1 : 1; }
  function getCurrentPick() { return draft ? (picks.length % draft.settings.teams) + 1 : 1; }
  function isMyTurn() {
    if (!draft || !mySlot) return false;
    const round = getCurrentRound();
    const pickInRound = picks.length % draft.settings.teams;
    if (draft.type === 'snake') return round % 2 === 1 ? (pickInRound + 1) === mySlot : (draft.settings.teams - pickInRound) === mySlot;
    return (pickInRound + 1) === mySlot;
  }
  function getMyPicks() { return mySlot ? picks.filter(p => p.draft_slot === mySlot) : []; }
  function getSquadCounts() {
    const counts = { QB:0, RB:0, WR:0, TE:0, K:0, DEF:0 };
    getMyPicks().forEach(p => { const pl = players?.[p.player_id]; if (pl && counts[pl.position] !== undefined) counts[pl.position]++; });
    return counts;
  }
  function getDrafterName(pick) {
    if (mockMode) return pick.picked_by === 'me' ? '★ You' : `Team ${pick.draft_slot}`;
    const u = leagueUsers.find(u => u.user_id === pick.picked_by);
    return u?.metadata?.team_name || u?.display_name || `Slot ${pick.draft_slot}`;
  }

  function generateRecs() {
    if (!players || !draft) return;
    const taken = new Set(picks.map(p => p.player_id));
    const counts = getSquadCounts();
    const round = getCurrentRound();
    const totalRounds = draft.settings.rounds || 15;
    const rosterSlots = draft.settings.roster_positions || [];
    const strat = STRATEGIES[strategy] || STRATEGIES['balanced'];

    const available = Object.entries(players)
      .filter(([id, p]) => !taken.has(id) && p.active && ['QB','RB','WR','TE','K','DEF'].includes(p.position) && p.team)
      .map(([id, p]) => ({ playerId: id, name: `${p.first_name} ${p.last_name}`, position: p.position, team: p.team, adp: p.search_rank || 9999, age: p.age }))
      .sort((a,b) => a.adp - b.adp)
      .slice(0, 250);

    const flexCount = rosterSlots.filter(s => ['FLEX','SUPER_FLEX','REC_FLEX','WRRB_FLEX'].includes(s)).length;
    const needed = {
      QB: rosterSlots.filter(s => s === 'QB' || s === 'SUPER_FLEX').length + 1,
      RB: rosterSlots.filter(s => s === 'RB').length + Math.ceil(flexCount * 0.5) + 2,
      WR: rosterSlots.filter(s => s === 'WR').length + Math.ceil(flexCount * 0.5) + 2,
      TE: rosterSlots.filter(s => s === 'TE' || s === 'REC_FLEX').length + 1,
      K: rosterSlots.filter(s => s === 'K').length,
      DEF: rosterSlots.filter(s => s === 'DEF').length
    };

    const scored = available.map(p => {
      let score = 1000 - p.adp;
      const roundIdx = Math.min(round - 1, 9);
      const posWeight = strat.weights[p.position]?.[roundIdx] || 50;
      score += (posWeight - 50) * 1.5;

      if (counts[p.position] < (needed[p.position] || 1)) score += 30;
      if (round <= 6 && counts[p.position] >= (needed[p.position] || 3)) score -= 40;
      if (round <= totalRounds - 3 && (p.position === 'K' || p.position === 'DEF')) score -= 150;
      if (round >= totalRounds - 1 && p.position === 'K' && counts.K === 0) score += 80;
      if (round >= totalRounds - 1 && p.position === 'DEF' && counts.DEF === 0) score += 80;

      const fallen = p.adp < picks.length - 5;
      if (fallen) score += 25;
      if (p.position === 'QB' && counts.QB >= 1 && !rosterSlots.includes('SUPER_FLEX')) score -= 60;

      let reason = '';
      if (fallen) reason = '📉 Fallen value — steal!';
      else if (posWeight >= 80) reason = `✅ Matches ${strat.name} plan`;
      else if (p.adp <= picks.length + 3) reason = '🔥 Top ADP — won\'t last';
      else if (counts[p.position] === 0 && round >= 5) reason = `📌 First ${p.position} — fill need`;

      return { ...p, score, reason };
    });

    scored.sort((a,b) => b.score - a.score);
    setRecs(scored.slice(0, 20));

    // Strategy note
    const roundIdx = Math.min(round - 1, 9);
    let note = isMyTurn() ? '🟢 YOUR PICK NOW!\n\n' : '';
    note += `📋 ${strat.name}\n`;
    note += `Round ${round} of ${totalRounds}\n\n`;

    const topRec = scored[0];
    const planPositions = Object.entries(strat.weights)
      .filter(([pos, w]) => w[roundIdx] >= 80)
      .map(([pos]) => pos);
    
    if (topRec && planPositions.length > 0 && !planPositions.includes(topRec.position)) {
      note += `⚡ PIVOT: ${topRec.name} (${topRec.position}) is a steal here — consider value over plan\n\n`;
    }

    if (round >= 7 && counts.QB === 0) note += '⚠️ No QB yet\n';
    if (round >= 9 && counts.TE === 0) note += '⚠️ No TE yet\n';
    if (round >= totalRounds - 1 && counts.K === 0) note += '⚠️ Need K\n';
    if (round >= totalRounds - 1 && counts.DEF === 0) note += '⚠️ Need DEF\n';

    setStrategyNote(note);
  }

  function handleSetSlot(val) {
    const s = parseInt(val);
    setMySlot(s);
    localStorage.setItem('nflDraftMySlot', s);
  }

  function handleSetStrategy(key) {
    setStrategy(key);
    localStorage.setItem('nflDraftStrategy', key);
  }

  const filteredRecs = posFilter === 'ALL' ? recs : recs.filter(r => r.position === posFilter);

  // ========== CONNECT SCREEN ==========
  if (!connected) {
    return (
      <div className="draft-room">
        <div className="draft-connect">
          <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
          <h1>🏈 Draft Room</h1>
          <p className="subtitle">Connect live to your Sleeper draft for real-time strategy recommendations</p>
          
          <div className="connect-form">
            <div className="input-group">
              <label>League ID</label>
              <input value={leagueId} onChange={e => setLeagueId(e.target.value)} placeholder="Your Sleeper league ID" />
              <span className="hint">Sleeper → League Settings → bottom of page</span>
            </div>
            <div className="input-group">
              <label>Draft ID (optional)</label>
              <input value={draftId} onChange={e => setDraftId(e.target.value)} placeholder="Direct draft ID if you have it" />
            </div>
            <div className="input-group">
              <label>Strategy</label>
              <div className="strategy-picker">
                {Object.entries(STRATEGIES).map(([key, s]) => (
                  <div key={key} className={`strat-option ${strategy === key ? 'selected' : ''}`} onClick={() => handleSetStrategy(key)}>
                    <strong>{s.name}</strong>
                    <span>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="connect-btn" onClick={connectToDraft} disabled={loading || (!leagueId && !draftId)}>
              {loading ? 'Connecting...' : '⚡ Connect to Draft'}
            </button>
            {!leagueId && !draftId && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>Enter a League ID or Draft ID above to connect</div>}
            <div style={{ textAlign: 'center', margin: '16px 0 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>— or —</div>
            <button className="connect-btn" style={{ background: 'var(--bg-card)', color: 'var(--gold)', border: '1px solid var(--gold)' }} onClick={() => startMockDraft(12, 15, 1)}>
              🧪 Start Mock Draft (12-team, pick your slot next)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== DRAFT ROOM ==========
  return (
    <div className="draft-room">
      <div className="draft-header">
        <div className="draft-header-left">
          <button className="back-btn" onClick={onBack}>←</button>
          <h1>Draft Room</h1>
          <span className="live-badge" style={mockMode ? { background: '#f59e0b' } : undefined}>{mockMode ? '🧪 MOCK' : '● LIVE'}</span>
        </div>
        <div className="draft-header-right">
          <span className="draft-info">
            Rd {getCurrentRound()} • Pick {getCurrentPick()}
            {isMyTurn() && <span className="your-turn"> — YOUR PICK!</span>}
          </span>
          {!mySlot && draft && (
            <select onChange={e => handleSetSlot(e.target.value)} defaultValue="">
              <option value="" disabled>Set my slot</option>
              {Array.from({ length: draft.settings.teams }, (_, i) => (
                <option key={i+1} value={i+1}>Slot {i+1}</option>
              ))}
            </select>
          )}
          {mySlot && <span className="my-slot-badge">Slot #{mySlot}</span>}
          {mockMode && !isMyTurn() && (
            <button className="change-strat-btn" onClick={mockAutoAdvance} style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }}>
              ▶ Sim to My Pick
            </button>
          )}
          {mockMode && !isMyTurn() && (
            <button className="change-strat-btn" onClick={mockSimulatePick}>
              ⏭ Next Pick
            </button>
          )}
          <button className="change-strat-btn" onClick={() => {
            const keys = Object.keys(STRATEGIES);
            const current = keys.indexOf(strategy);
            const next = (current + 1) % keys.length;
            handleSetStrategy(keys[next]);
            generateRecs();
          }}>🔄 {STRATEGIES[strategy]?.name || 'Strategy'}</button>
        </div>
      </div>

      <div className="draft-layout">
        <div className="draft-board-section">
          <h2>Draft Board — {picks.length} picks made</h2>
          <div className="draft-picks-list">
            {picks.length === 0 && <div className="waiting-msg">Waiting for draft to start...</div>}
            {[...picks].reverse().map((pick, i) => {
              const pl = players?.[pick.player_id];
              return (
                <div key={i} className={`pick-row ${pick.draft_slot === mySlot ? 'my-pick' : ''}`}>
                  <span className="pick-num">{pick.round}.{pick.pick_no || pick.draft_slot}</span>
                  <span className={`pick-pos pos-${(pl?.position || '').toLowerCase()}`}>{pl?.position || '??'}</span>
                  <span className="pick-player">{pl ? `${pl.first_name} ${pl.last_name}` : pick.player_id}</span>
                  <span className="pick-team">{pl?.team || ''}</span>
                  <span className="pick-drafter">{getDrafterName(pick)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="draft-recs-section">
          <div className="recs-tabs">
            <button className={activeTab === 'recs' ? 'active' : ''} onClick={() => setActiveTab('recs')}>Recommendations</button>
            <button className={activeTab === 'squad' ? 'active' : ''} onClick={() => setActiveTab('squad')}>My Squad</button>
          </div>
          <div className="panel-content">
            {activeTab === 'recs' && (
              <div className="recs-content">
                {strategyNote && <div className="strategy-box">{strategyNote}</div>}
                <div className="pos-filters">
                  {['ALL','QB','RB','WR','TE','K','DEF'].map(p => (
                    <button key={p} className={posFilter === p ? 'active' : ''} onClick={() => setPosFilter(p)}>{p}</button>
                  ))}
                </div>
                <div className="recs-list">
                  {filteredRecs.length === 0 && <div className="waiting-msg">Recommendations appear once the draft starts</div>}
                  {filteredRecs.slice(0, 15).map((rec, i) => (
                    <div key={rec.playerId} className={`rec-card ${i === 0 ? 'top-pick' : ''}`}
                      onClick={mockMode && isMyTurn() ? () => mockMakePick(rec.playerId) : undefined}
                      style={mockMode && isMyTurn() ? { cursor: 'pointer' } : undefined}
                    >
                      <div className="rec-header">
                        <span className={`rec-pos pos-${rec.position.toLowerCase()}`}>{rec.position}</span>
                        <span className="rec-name">{rec.name}</span>
                      </div>
                      <div className="rec-details">
                        <span>{rec.team}</span>
                        <span>ADP: {rec.adp}</span>
                        {rec.age && <span>Age: {rec.age}</span>}
                      </div>
                      {i === 0 && <div className="rec-tag">★ Top Pick</div>}
                      {rec.reason && <div className="rec-reason">{rec.reason}</div>}
                      {mockMode && isMyTurn() && <div className="rec-reason" style={{ color: '#10b981' }}>⬆ Click to draft</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'squad' && (
              <div className="squad-content">
                <h3>My Picks ({getMyPicks().length})</h3>
                {getMyPicks().length === 0 ? <div className="waiting-msg">No picks yet</div> : (
                  <div className="squad-list">
                    {getMyPicks().map((pick, i) => {
                      const pl = players?.[pick.player_id];
                      return (
                        <div key={i} className="squad-row">
                          <span className="pick-num">Rd {pick.round}</span>
                          <span className={`pick-pos pos-${(pl?.position||'').toLowerCase()}`}>{pl?.position}</span>
                          <span className="pick-player">{pl ? `${pl.first_name} ${pl.last_name}` : pick.player_id}</span>
                          <span className="pick-team">{pl?.team}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="squad-counts">
                  <h4>Roster</h4>
                  {Object.entries(getSquadCounts()).map(([pos, count]) => (
                    <div key={pos} className="count-row">
                      <span>{pos}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DraftRoom;
