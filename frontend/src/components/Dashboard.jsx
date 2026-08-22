import React, { useState, useEffect, useRef } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { awsConfig } from '../aws-config';
import GradeGauge, { PositionGrades } from './GradeGauge';
import MOCK_DATASETS from './mockAnalysis';
import './Dashboard.css';

function Dashboard({ user, onNavigateToSettings, onNavigateToDraft, onNavigateToFPL, onNavigateToFPLCenter }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [activeTab, setActiveTab] = useState('recs');
  const [animKey, setAnimKey] = useState(0);
  const [demoMode, setDemoMode] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [leagueType, setLeagueType] = useState('redraft');
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function getToken() {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  }

  async function loadDashboard() {
    try {
      const token = await getToken();
      const [analysisRes, configRes] = await Promise.all([
        fetch(`${awsConfig.apiEndpoint}/analysis/latest`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${awsConfig.apiEndpoint}/user/config`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAnalysis(await analysisRes.json());
      const config = await configRes.json();
      setLeagueType(config.leagueType || 'redraft');
    } catch (err) {
      console.error('Load error:', err);
    } finally { setLoading(false); }
  }

  async function runAnalysis() {
    setRunning(true);
    setProgress('Starting analysis...');
    try {
      const token = await getToken();
      const res = await fetch(`${awsConfig.apiEndpoint}/analysis/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await res.json();
      if (result?.limitReached) {
        setRunning(false); setProgress('');
        alert('Free tier limit reached. Upgrade to Pro for unlimited analysis.');
        return;
      }

      const steps = ['Fetching your roster...', 'Analyzing player matchups...', 'Running AI recommendations...', 'Finalizing your report...'];
      let stepIndex = 0;
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;
        if (stepIndex < steps.length) { setProgress(steps[stepIndex]); stepIndex++; }
        try {
          const token2 = await getToken();
          const pollRes = await fetch(`${awsConfig.apiEndpoint}/analysis/latest`, {
            headers: { Authorization: `Bearer ${token2}` }
          });
          const newData = await pollRes.json();
          if (newData?.lastUpdated && newData.lastUpdated !== analysis?.lastUpdated) {
            clearInterval(pollInterval);
            setAnalysis(newData);
            setProgress(''); setRunning(false);
          } else if (attempts >= 12) {
            clearInterval(pollInterval);
            await loadDashboard();
            setProgress(''); setRunning(false);
          }
        } catch {
          if (attempts >= 12) { clearInterval(pollInterval); setProgress(''); setRunning(false); }
        }
      }, 5000);
    } catch (err) {
      alert(err.message || 'Analysis failed');
      setProgress(''); setRunning(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(`${awsConfig.apiEndpoint}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          context: {
            analysis: analysis,
            conversationHistory: chatMessages.slice(-10)
          }
        })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Sorry, I could not generate a response.' }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setAnimKey(prev => prev + 1);
  }

  function toggleCard(id) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function cleanText(text) {
    return (text || '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^-\s*/gm, '• ')
      .trim();
  }

  function getPriorityIcon(priority) {
    if (priority === 'critical') return '🔴';
    if (priority === 'high') return '🟠';
    if (priority === 'medium') return '🟡';
    return '⚪';
  }

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>;

  const recs = analysis?.recommendations || [];

  return (
    <div className="dashboard">
      <header className="dash-header">
        <img src="/logo.png" alt="Helix Sideline" className="dash-logo" />
        <div className="dash-actions">
          <button className="btn btn-secondary" onClick={onNavigateToDraft}>🏈 NFL Draft</button>
          <button className="btn btn-secondary" onClick={onNavigateToFPL}>⚽ FPL Draft</button>
          <button className="btn btn-secondary" onClick={onNavigateToFPLCenter}>⚽ FPL Center</button>
          <button className="btn btn-secondary" onClick={onNavigateToSettings}>Settings</button>
          <button className="btn btn-secondary" onClick={async () => { await signOut(); window.location.reload(); }}>Sign Out</button>
        </div>
      </header>

      <div className="dash-layout">
        {/* Main Content Column */}
        <main className="dash-main">
          {/* Top Bar: Grade + Run */}
          <div className="dash-top-bar">
            <div className="dash-top-left">
              {analysis?.lineupGrade && analysis.lineupGrade.overallGrade && analysis.lineupGrade.overallGrade !== 'N/A' && (
                <div className="grade-compact">
                  <GradeGauge grade={analysis.lineupGrade.overallGrade} score={analysis.lineupGrade.overallScore} />
                </div>
              )}
              <div className="dash-meta">
                <h1>{leagueType === 'dynasty' ? 'Dynasty Command Center' : leagueType === 'keeper' ? 'Keeper Command Center' : 'Game Day Command Center'}</h1>
                {analysis?.lastUpdated && <p className="updated">Last analysis: {new Date(analysis.lastUpdated).toLocaleDateString()}</p>}
              </div>
            </div>
            <button className={`btn btn-primary btn-run ${running ? 'disabled' : ''}`} onClick={runAnalysis} disabled={running}>
              {running ? progress || 'Running...' : 'Run Analysis'}
            </button>
          </div>

          {/* Position Grades Row */}
          {analysis?.lineupGrade?.positionGrades && (
            <div className="position-grades-row">
              <PositionGrades grades={analysis.lineupGrade.positionGrades} />
            </div>
          )}

          {/* Tab Bar */}
          <div className="tab-bar">
            <button className={`tab-button ${activeTab === 'recs' ? 'active' : ''}`} onClick={() => handleTabChange('recs')}>
              Insights
            </button>
            {analysis?.dynastyTradeInsights && (leagueType === 'dynasty' || leagueType === 'keeper') && (
              <button className={`tab-button ${activeTab === 'trades' ? 'active' : ''}`} onClick={() => handleTabChange('trades')}>
                Trades
              </button>
            )}
            <button className={`tab-button ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => handleTabChange('roster')}>
              Roster
            </button>
            <button className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => handleTabChange('analysis')}>
              Deep Dive
            </button>
          </div>

          {/* Tab: Insights (Recommendations redesigned) */}
          {activeTab === 'recs' && (
            <div className="insights-grid" key={`recs-${animKey}`}>
              {recs.length > 0 ? recs.map((rec, i) => {
                const lines = cleanText(rec.text).split('\n').filter(l => l.trim());
                const isExpanded = expandedCards.has(`rec-${i}`);
                const preview = lines[0] || '';
                const hasMore = lines.length > 1;

                return (
                  <div
                    key={i}
                    className={`insight-card insight-card-animate ${rec.priority === 'high' || rec.priority === 'critical' ? 'insight-hot' : ''} ${isExpanded ? 'expanded' : ''}`}
                    style={{ '--stagger-delay': `${Math.min(i * 40, 200)}ms` }}
                    onClick={() => hasMore && toggleCard(`rec-${i}`)}
                  >
                    <div className="insight-top">
                      <span className="insight-icon">{getPriorityIcon(rec.priority)}</span>
                      <span className="insight-type">{(rec.type || '').replace('_', ' ')}</span>
                      {hasMore && <span className="insight-expand">{isExpanded ? '−' : '+'}</span>}
                    </div>
                    <p className="insight-preview">{preview}</p>
                    {isExpanded && lines.slice(1).map((line, j) => (
                      <p key={j} className="insight-detail">{line.trim()}</p>
                    ))}
                  </div>
                );
              }) : (
                <div className="empty-card">
                  <h3>No Insights Yet</h3>
                  <p>{analysis?.message || 'Run an analysis to get dynasty-specific recommendations.'}</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Dynasty Trades */}
          {activeTab === 'trades' && analysis?.dynastyTradeInsights && (
            <div className="trades-section" key={`trades-${animKey}`}>
              {/* Trade Packages */}
              {analysis.dynastyTradeInsights.tradePackages?.length > 0 && (
                <div className="trade-group">
                  <h3 className="trade-group-title">Recommended Trades</h3>
                  {analysis.dynastyTradeInsights.tradePackages.map((pkg, i) => (
                    <div key={i} className="trade-card trade-card-animate" style={{ '--stagger-delay': `${i * 60}ms` }}>
                      <div className="trade-card-header">
                        <span className="trade-target-team">{pkg.targetTeam}</span>
                        <span className="trade-record-badge">{pkg.targetRecord}</span>
                      </div>
                      <div className="trade-flow">
                        <div className="trade-side trade-send">
                          <span className="trade-label">You Send</span>
                          <div className="trade-players">
                            {pkg.send.map((p, j) => (
                              <span key={j} className="player-chip send">{p.name} <small>{p.position}</small></span>
                            ))}
                          </div>
                        </div>
                        <div className="trade-arrow">⇄</div>
                        <div className="trade-side trade-receive">
                          <span className="trade-label">You Get</span>
                          <div className="trade-players">
                            {pkg.receive.map((p, j) => (
                              <span key={j} className="player-chip receive">{p.name} <small>{p.position} · {p.age}</small></span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="trade-reasoning">{pkg.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Sell High / Buy Low in a two-column grid */}
              <div className="trade-columns">
                {analysis.dynastyTradeInsights.sellHighCandidates?.length > 0 && (
                  <div className="trade-group">
                    <h3 className="trade-group-title sell">Sell High</h3>
                    {analysis.dynastyTradeInsights.sellHighCandidates.map((p, i) => (
                      <div key={i} className="mini-trade-card sell">
                        <div className="mini-trade-top">
                          <span className="player-name">{p.player}</span>
                          <span className="player-meta">{p.position} · Age {p.age}</span>
                        </div>
                        <p className="mini-trade-reason">{p.dynastyAdvice}</p>
                        {p.potentialBuyers?.length > 0 && (
                          <div className="buyer-chips">
                            {p.potentialBuyers.map((b, j) => <span key={j} className="buyer-chip">{b}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {analysis.dynastyTradeInsights.buyLowTargets?.length > 0 && (
                  <div className="trade-group">
                    <h3 className="trade-group-title buy">Buy Low</h3>
                    {analysis.dynastyTradeInsights.buyLowTargets.map((t, i) => (
                      <div key={i} className="mini-trade-card buy">
                        <div className="mini-trade-top">
                          <span className="player-name">{t.player}</span>
                          <span className="player-meta">{t.position} · Age {t.age}</span>
                        </div>
                        <p className="mini-trade-owner">Owner: {t.owner}</p>
                        <p className="mini-trade-reason">{t.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* League Landscape */}
              {analysis.dynastyTradeInsights.leagueTradeOpportunities?.length > 0 && (
                <div className="trade-group">
                  <h3 className="trade-group-title">League Landscape</h3>
                  {analysis.dynastyTradeInsights.leagueTradeOpportunities.map((opp, i) => (
                    <div key={i} className="landscape-card">
                      <span className="landscape-type">{opp.type}</span>
                      <p className="landscape-advice">{opp.advice}</p>
                      <div className="landscape-teams">
                        {opp.teams.map((t, j) => (
                          <span key={j} className="team-badge">{t.name} ({t.record})</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Roster */}
          {activeTab === 'roster' && (
            <div className="roster-section" key={`roster-${animKey}`}>
              {analysis?.lineupOptimizations?.length > 0 && (
                <div className="trade-group">
                  <h3 className="trade-group-title">Lineup Swaps</h3>
                  {analysis.lineupOptimizations.map((opt, i) => (
                    <div key={i} className="swap-card">
                      <div className="swap-flow">
                        <span className="player-chip send">{opt.swap.out} <small>OUT</small></span>
                        <span className="swap-arrow">→</span>
                        <span className="player-chip receive">{opt.swap.in} <small>IN</small></span>
                      </div>
                      <p className="swap-reason">{opt.swap.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}
              {analysis?.waiverTargets?.length > 0 && (
                <div className="trade-group">
                  <h3 className="trade-group-title">Waiver Targets</h3>
                  {analysis.waiverTargets.filter(t => t.position !== 'DROP' && t.position !== 'TRADE').map((target, i) => (
                    <div key={i} className="waiver-card">
                      <div className="waiver-header">
                        <span className="waiver-position">{target.position}</span>
                        <span className={`rec-priority ${target.priority}`}>{target.priority}</span>
                      </div>
                      <p className="waiver-reasoning">{target.reasoning}</p>
                      {target.specificTargets?.length > 0 && (
                        <div className="waiver-targets">
                          {target.specificTargets.slice(0, 3).map((t, j) => (
                            <span key={j} className="player-chip receive">{t.name || t} <small>{t.team || ''}</small></span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Deep Dive (Full Analysis) */}
          {activeTab === 'analysis' && (
            <div className="deep-dive" key={`analysis-${animKey}`}>
              {analysis?.analysis ? (
                <div className="analysis-card">
                  {cleanText(analysis.analysis).split('\n').filter(l => l.trim()).map((line, i) => {
                    const isHeading = /^[A-Z\s]{4,}:?$/.test(line.trim()) || line.includes('ANALYSIS') || line.includes('OVERVIEW') || line.includes('LINEUP') || line.includes('STRATEGY') || line.includes('MATCHUP');
                    return (
                      <p key={i} className={isHeading ? 'analysis-heading' : 'analysis-line'}>
                        {line.trim()}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-card">
                  <h3>No Analysis Available</h3>
                  <p>Run an analysis to see the full AI breakdown.</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Chat Column */}
        <aside className="chat-panel">
          <div className="chat-header">
            <div className="chat-title">
              <span className="chat-dot"></span>
              {leagueType === 'dynasty' ? 'Dynasty Advisor' : leagueType === 'keeper' ? 'Keeper Advisor' : 'Fantasy Advisor'}
            </div>
            <small className="chat-subtitle">Ask about {leagueType === 'dynasty' || leagueType === 'keeper' ? 'trades, roster moves, draft strategy' : 'lineup decisions, matchups, waivers'}</small>
          </div>
          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="chat-welcome">
                <p>I'm your {leagueType === 'dynasty' ? 'dynasty' : 'fantasy'} AI advisor. I can see your full roster, league data, and analysis.</p>
                <div className="chat-suggestions">
                  {(leagueType === 'dynasty' || leagueType === 'keeper') ? (
                    <>
                      <button onClick={() => { setChatInput('Should I sell any aging players?'); }}>Sell candidates?</button>
                      <button onClick={() => { setChatInput('What are my biggest roster weaknesses?'); }}>Roster weaknesses?</button>
                      <button onClick={() => { setChatInput('Who should I target in trades?'); }}>Trade targets?</button>
                      <button onClick={() => { setChatInput('What picks do I have and what should I do with them?'); }}>Draft picks?</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setChatInput('Who should I start this week?'); }}>Start/sit?</button>
                      <button onClick={() => { setChatInput('What are my biggest roster weaknesses?'); }}>Roster weaknesses?</button>
                      <button onClick={() => { setChatInput('Who should I pick up on waivers?'); }}>Waiver targets?</button>
                      <button onClick={() => { setChatInput('How does my matchup look this week?'); }}>Matchup outlook?</button>
                    </>
                  )}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role}`}>
                <div className="chat-bubble">
                  {msg.content.split('\n').map((line, j) => {
                    // Strip markdown formatting
                    const clean = line
                      .replace(/#{1,6}\s*/g, '')
                      .replace(/\*\*(.*?)\*\*/g, '$1')
                      .replace(/\*(.*?)\*/g, '$1')
                      .replace(/^[-*]\s/, '• ');
                    return clean.trim() ? <p key={j}>{clean}</p> : null;
                  })}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-msg assistant">
                <div className="chat-bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              className="chat-input"
              placeholder="Ask about your dynasty team..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
            />
            <button className="chat-send" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
              ↑
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Dashboard;
