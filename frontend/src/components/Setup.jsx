import React, { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { awsConfig } from '../aws-config';
import './Setup.css';

function Setup({ user, onComplete, onCancel, addingLeague = false }) {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState('sleeper');
  const [leagueType, setLeagueType] = useState(''); // 'dynasty', 'keeper', or 'redraft'
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [sleeperUserId, setSleeperUserId] = useState('');
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [espnLeagueId, setEspnLeagueId] = useState('');
  const [espnS2, setEspnS2] = useState('');
  const [espnSwid, setEspnSwid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Receive ESPN credentials from browser extension via postMessage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEspnConnect = params.get('espn_connect');

    if (isEspnConnect) {
      // Clean URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      setPlatform('espn');
      setStep(2);
    }

    function handleMessage(event) {
      // Only accept messages from our extension or same origin
      if (event.data?.type !== 'HELIX_ESPN_CREDENTIALS') return;
      const { espn_s2, espn_swid, league_id } = event.data;
      if (espn_s2 && espn_swid) {
        setEspnS2(espn_s2);
        setEspnSwid(espn_swid);
        setPlatform('espn');
        if (league_id) setEspnLeagueId(league_id);
        setStep(league_id ? 4 : 2);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  async function lookupSleeperUser() {
    const rawUsername = sleeperUsername.trim();
    if (!rawUsername) { setError('Enter your Sleeper username'); return; }
    setError(''); setLoading(true);

    // Sleeper usernames are lowercase and must be URL-encoded (handles spaces/symbols)
    const lookup = encodeURIComponent(rawUsername.toLowerCase());

    // Step 1: look up the user (network errors surface as "Failed to fetch")
    let userData;
    try {
      const userRes = await fetch(`https://api.sleeper.app/v1/user/${lookup}`);
      userData = userRes.ok ? await userRes.json() : null;
    } catch (netErr) {
      console.error('Sleeper user lookup network error:', netErr);
      setError('Could not reach Sleeper. Check your internet connection and try again.');
      setLoading(false);
      return;
    }

    if (!userData || !userData.user_id) {
      setError(`"${rawUsername}" not found on Sleeper. Use your Sleeper username (not display name), and check for typos.`);
      setLoading(false);
      return;
    }
    setSleeperUserId(userData.user_id);

    // Step 2: gather leagues across seasons
    try {
      const year = new Date().getFullYear();
      const yearsToCheck = [year, year + 1, year - 1];
      let allLeagues = [];
      for (const y of yearsToCheck) {
        try {
          const res = await fetch(`https://api.sleeper.app/v1/user/${userData.user_id}/leagues/nfl/${y}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const existingIds = new Set(allLeagues.map(l => l.league_id));
            allLeagues = [...allLeagues, ...data.filter(l => !existingIds.has(l.league_id))];
          }
        } catch { /* skip year on error */ }
      }
      if (allLeagues.length === 0) {
        setError(`No NFL leagues found for @${rawUsername}. Make sure you have a league on Sleeper for this season.`);
        setLoading(false);
        return;
      }
      setLeagues(allLeagues);
      setStep(3);
    } catch (err) {
      console.error('Sleeper leagues lookup error:', err);
      setError('Could not load your leagues from Sleeper. Please try again.');
    } finally { setLoading(false); }
  }

  async function handleSubmit() {
    setError(''); setLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) {
        setError('Your session expired. Please sign out and sign back in.');
        setLoading(false);
        return;
      }
      const body = platform === 'sleeper'
        ? { platform: 'sleeper', leagueId: selectedLeague.league_id, leagueName: selectedLeague.name || '', platformUserId: sleeperUserId, leagueType }
        : { platform: 'espn', leagueId: espnLeagueId, leagueName: '', espnS2: espnS2 || undefined, espnSwid: espnSwid || undefined, leagueType };

      let res;
      try {
        res = await fetch(`${awsConfig.apiEndpoint}/user/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
      } catch (netErr) {
        console.error('Setup network error:', netErr);
        setError('Could not reach the server. Check your connection and try again.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        let d = {};
        try { d = await res.json(); } catch {}
        if (d.limitReached) throw new Error(d.error || 'League limit reached. Upgrade to Pro to add more leagues.');
        throw new Error(d.error || `Setup failed (${res.status})`);
      }
      onComplete();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function statusLabel(status) {
    const map = { in_season: 'Active', pre_draft: 'Pre-Draft', drafting: 'Drafting', complete: 'Complete' };
    return map[status] || status;
  }

  function openESPNLogin() {
    // Don't navigate away — just show instructions
    setShowEspnHelp(true);
  }

  const [showEspnHelp, setShowEspnHelp] = useState(false);

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-progress">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`}>{s}</div>
          ))}
        </div>

        <h1 className="setup-title">{addingLeague ? 'Add Another League' : 'Connect Your League'}</h1>
        {onCancel && (
          <button className="link-btn" style={{ marginBottom: 12 }} onClick={onCancel}>← Cancel</button>
        )}

        {/* Step 1: Platform */}
        {step === 1 && (
          <div>
            <h2 className="step-title">Choose Your Platform</h2>
            <div className="platform-cards">
              <div className={`plat-card ${platform === 'sleeper' ? 'selected' : ''}`} onClick={() => setPlatform('sleeper')}>
                <div className="plat-name">Sleeper</div>
                <div className="plat-desc">Just enter your username — we find your leagues automatically</div>
              </div>
              <div className={`plat-card ${platform === 'espn' ? 'selected' : ''}`} onClick={() => setPlatform('espn')}>
                <div className="plat-name">ESPN</div>
                <div className="plat-desc">Sign in with your ESPN account to connect</div>
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setStep(2)}>Continue</button>
          </div>
        )}

        {/* Step 2: Sleeper */}
        {step === 2 && platform === 'sleeper' && (
          <div>
            <h2 className="step-title">Enter Your Sleeper Username</h2>
            <p className="hint">We'll find your leagues automatically.</p>
            <input type="text" placeholder="e.g. fantasychamp99" value={sleeperUsername}
              onChange={e => setSleeperUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupSleeperUser()} />
            {error && <div className="error-message">{error}</div>}
            <button className="btn btn-primary btn-full" onClick={lookupSleeperUser} disabled={loading}>
              {loading ? 'Searching...' : 'Find My Leagues'}
            </button>
            <button className="link-btn" onClick={() => setStep(1)}>← Back</button>
          </div>
        )}

        {/* Step 2: ESPN */}
        {step === 2 && platform === 'espn' && (
          <div>
            <h2 className="step-title">Connect ESPN League</h2>

            {espnS2 && espnSwid ? (
              <>
                <div className="connected-badge">ESPN session connected</div>
                <div className="form-section">
                  <label>League ID</label>
                  <input type="text" placeholder="e.g. 437597828" value={espnLeagueId}
                    onChange={e => setEspnLeagueId(e.target.value)} />
                </div>
                {error && <div className="error-message">{error}</div>}
                <button className="btn btn-primary btn-full" onClick={() => setStep(4)} disabled={!espnLeagueId}>
                  Continue
                </button>
              </>
            ) : (
              <>
                <div className="method-card-web recommended" onClick={() => {}}>
                  <div className="method-title">Use the Chrome Extension</div>
                  <div className="method-desc">One click — no copying, no dev tools</div>
                  <div className="espn-steps">
                    <div className="espn-step">
                      <div className="espn-step-num">1</div>
                      <div>
                        <p className="espn-step-title">Install the extension</p>
                        <p className="espn-step-desc">
                          <a href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">
                            Get "Helix Sideline - ESPN Connector" from the Chrome Web Store
                          </a>
                        </p>
                      </div>
                    </div>
                    <div className="espn-step">
                      <div className="espn-step-num">2</div>
                      <div>
                        <p className="espn-step-title">Go to your ESPN league</p>
                        <p className="espn-step-desc">
                          Open <a href="https://fantasy.espn.com" target="_blank" rel="noreferrer">fantasy.espn.com</a>, sign in, and go to your league page
                        </p>
                      </div>
                    </div>
                    <div className="espn-step">
                      <div className="espn-step-num">3</div>
                      <div>
                        <p className="espn-step-title">Click the extension icon</p>
                        <p className="espn-step-desc">It auto-detects your league and session. Click "Connect to Helix Sideline" and you're done.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="divider"><span>or connect manually</span></div>

                <div className="form-section">
                  <label>League ID</label>
                  <input type="text" placeholder="e.g. 437597828" value={espnLeagueId}
                    onChange={e => setEspnLeagueId(e.target.value)} />
                  <label>espn_s2 <span className="optional">(private leagues)</span></label>
                  <input type="password" placeholder="Paste espn_s2 value" value={espnS2}
                    onChange={e => setEspnS2(e.target.value)} />
                  <label>SWID <span className="optional">(private leagues)</span></label>
                  <input type="text" placeholder="Paste SWID value" value={espnSwid}
                    onChange={e => setEspnSwid(e.target.value)} />
                </div>

                {error && <div className="error-message">{error}</div>}
                <button className="btn btn-primary btn-full" onClick={() => setStep(4)} disabled={!espnLeagueId}>
                  Continue
                </button>
              </>
            )}
            <button className="link-btn" onClick={() => setStep(1)}>← Back</button>
          </div>
        )}

        {/* Step 3: League Selection (Sleeper) */}
        {step === 3 && platform === 'sleeper' && (
          <div>
            <h2 className="step-title">Select Your League</h2>
            <p className="hint">Found {leagues.length} league{leagues.length !== 1 ? 's' : ''} for @{sleeperUsername}</p>
            <div className="league-list">
              {leagues.map(league => (
                <div key={league.league_id}
                  className={`league-card ${selectedLeague?.league_id === league.league_id ? 'selected' : ''}`}
                  onClick={() => setSelectedLeague(league)}>
                  <div>
                    <div className="league-name">{league.name}</div>
                    <div className="league-meta">{league.total_rosters} teams · {league.season} · {statusLabel(league.status)}</div>
                  </div>
                  {selectedLeague?.league_id === league.league_id && <span className="check">✓</span>}
                </div>
              ))}
            </div>
            {error && <div className="error-message">{error}</div>}
            <button className="btn btn-primary btn-full" onClick={() => setStep(4)} disabled={!selectedLeague}>
              Continue
            </button>
            <button className="link-btn" onClick={() => { setStep(2); setLeagues([]); setSelectedLeague(null); }}>
              ← Try different username
            </button>
          </div>
        )}

        {/* Step 4: League Type */}
        {step === 4 && (
          <div>
            <h2 className="step-title">What type of league is this?</h2>
            <p className="hint">This helps us tailor your analysis and recommendations.</p>
            <div className="platform-cards">
              <div className={`plat-card ${leagueType === 'dynasty' ? 'selected' : ''}`} onClick={() => setLeagueType('dynasty')}>
                <div className="plat-name">Dynasty</div>
                <div className="plat-desc">Keep your full roster year to year. Trade draft picks years out. Build long-term.</div>
              </div>
              <div className={`plat-card ${leagueType === 'keeper' ? 'selected' : ''}`} onClick={() => setLeagueType('keeper')}>
                <div className="plat-name">Keeper</div>
                <div className="plat-desc">Keep a few players each year. Mix of redraft and dynasty.</div>
              </div>
              <div className={`plat-card ${leagueType === 'redraft' ? 'selected' : ''}`} onClick={() => setLeagueType('redraft')}>
                <div className="plat-name">Redraft</div>
                <div className="plat-desc">Fresh draft every year. Win now, no long-term roster building.</div>
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setStep(5)} disabled={!leagueType}>
              Continue
            </button>
            <button className="link-btn" onClick={() => setStep(platform === 'sleeper' ? 3 : 2)}>← Back</button>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === 5 && (
          <div>
            <h2 className="step-title">Confirm & Connect</h2>
            <div className="summary-card">
              <div className="summary-row"><span>Platform</span><span>{platform === 'sleeper' ? 'Sleeper' : 'ESPN'}</span></div>
              <div className="summary-row"><span>League Type</span><span>{leagueType === 'dynasty' ? 'Dynasty' : leagueType === 'keeper' ? 'Keeper' : 'Redraft'}</span></div>
              {platform === 'sleeper' && selectedLeague && (
                <>
                  <div className="summary-row"><span>League</span><span>{selectedLeague.name}</span></div>
                  <div className="summary-row"><span>Teams</span><span>{selectedLeague.total_rosters}</span></div>
                  <div className="summary-row"><span>Season</span><span>{selectedLeague.season}</span></div>
                </>
              )}
              {platform === 'espn' && (
                <div className="summary-row"><span>League ID</span><span>{espnLeagueId}</span></div>
              )}
            </div>
            {error && <div className="error-message">{error}</div>}
            <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
            <button className="link-btn" onClick={() => setStep(4)}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Setup;
