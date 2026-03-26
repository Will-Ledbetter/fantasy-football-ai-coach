import React, { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import SleeperOAuth from './SleeperOAuth';
import './Setup.css';
import './SleeperOAuth.css';

function Setup({ user, onComplete }) {
  const [platform, setPlatform] = useState('sleeper');
  const [leagueId, setLeagueId] = useState('');
  const [userId, setUserId] = useState('');
  const [espnS2, setEspnS2] = useState('');
  const [espnSwid, setEspnSwid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [leagueUrl, setLeagueUrl] = useState('');
  const [setupMethod, setSetupMethod] = useState(''); // 'oauth', 'url', 'manual'

  // Auto-detect league info from URL
  function parseLeagueUrl(url) {
    const patterns = {
      sleeper: /sleeper\.app\/leagues\/(\d+)/,
      espn: /fantasy\.espn\.com\/football\/league\?leagueId=(\d+)/,
      yahoo: /football\.fantasysports\.yahoo\.com\/f1\/(\d+)/
    };
    
    for (const [platformName, pattern] of Object.entries(patterns)) {
      const match = url.match(pattern);
      if (match) {
        return { platform: platformName, leagueId: match[1] };
      }
    }
    return null;
  }

  function handleUrlPaste(e) {
    const url = e.target.value;
    setLeagueUrl(url);
    
    const detected = parseLeagueUrl(url);
    if (detected) {
      setPlatform(detected.platform);
      setLeagueId(detected.leagueId);
      setError('');
    }
  }

  async function testConnection() {
    setLoading(true);
    setError('');
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const testData = {
        platform,
        leagueId,
        ...(platform === 'espn' ? { espnS2, espnSwid } : { platformUserId: userId })
      };

      const response = await fetch(`https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/user/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      
      if (response.ok) {
        setStep(3); // Move to confirmation step
      } else {
        setError(result.error || 'Connection test failed');
      }
    } catch (err) {
      setError('Failed to test connection: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get auth token
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Save league configuration
      const body = {
        platform: platform,
        leagueId: leagueId
      };

      if (platform === 'espn') {
        body.espnS2 = espnS2;
        body.espnSwid = espnSwid;
      } else {
        body.platformUserId = userId;
      }

      const response = await fetch(`https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/user/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      onComplete();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-progress">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        <h1>🏈 Welcome to Fantasy Football AI Coach</h1>
        
        {step === 1 && (
          <div className="step-content">
            <h2>Step 1: Choose Your Platform</h2>
            <p>Select your fantasy football platform to get started</p>

            <div className="platform-selector">
              <div 
                className={`platform-card ${platform === 'sleeper' ? 'selected' : ''}`}
                onClick={() => setPlatform('sleeper')}
              >
                <div className="platform-icon">💤</div>
                <h3>Sleeper</h3>
                <p>Easy setup, OAuth available</p>
                <div className="difficulty easy">Easy</div>
              </div>

              <div 
                className={`platform-card ${platform === 'espn' ? 'selected' : ''}`}
                onClick={() => setPlatform('espn')}
              >
                <div className="platform-icon">🏈</div>
                <h3>ESPN</h3>
                <p>Requires browser cookies</p>
                <div className="difficulty medium">Medium</div>
              </div>

              <div className="platform-card disabled">
                <div className="platform-icon">🟣</div>
                <h3>Yahoo</h3>
                <p>Coming soon!</p>
                <div className="difficulty">Soon</div>
              </div>
            </div>

            <button 
              className="next-button"
              onClick={() => setStep(2)}
              disabled={!platform}
            >
              Continue with {platform === 'sleeper' ? 'Sleeper' : platform === 'espn' ? 'ESPN' : 'Selected Platform'}
            </button>
          </div>
        )}

        {step === 2 && platform === 'sleeper' && !setupMethod && (
          <div className="step-content">
            <h2>Choose Setup Method for Sleeper</h2>
            <p>Pick the easiest option for you</p>

            <div className="setup-methods">
              <div 
                className="method-card recommended"
                onClick={() => setSetupMethod('oauth')}
              >
                <div className="method-icon">🚀</div>
                <h3>One-Click OAuth</h3>
                <p>Secure, instant connection</p>
                <div className="method-badge">Recommended</div>
                <div className="method-time">30 seconds</div>
              </div>

              <div 
                className="method-card"
                onClick={() => setSetupMethod('url')}
              >
                <div className="method-icon">🔗</div>
                <h3>URL Auto-Detection</h3>
                <p>Paste your league URL</p>
                <div className="method-time">2 minutes</div>
              </div>

              <div 
                className="method-card"
                onClick={() => setSetupMethod('manual')}
              >
                <div className="method-icon">⚙️</div>
                <h3>Manual Setup</h3>
                <p>Enter IDs manually</p>
                <div className="method-time">5 minutes</div>
              </div>
            </div>

            <button 
              className="back-button"
              onClick={() => setStep(1)}
            >
              ← Back to Platform Selection
            </button>
          </div>
        )}

        {step === 2 && platform === 'sleeper' && setupMethod === 'oauth' && (
          <div className="step-content">
            <SleeperOAuth 
              onSuccess={onComplete}
              onError={setError}
            />
            <button 
              className="back-button"
              onClick={() => setSetupMethod('')}
            >
              ← Try Different Method
            </button>
          </div>
        )}

        {step === 2 && (setupMethod === 'url' || setupMethod === 'manual' || platform === 'espn') && (
          <div className="step-content">
            <h2>Step 2: Connect Your League</h2>
            
            <div className="quick-connect">
              <h3>🚀 Quick Connect</h3>
              <p>Paste your league URL for instant setup:</p>
              <input
                type="url"
                placeholder={platform === 'sleeper' 
                  ? "https://sleeper.app/leagues/123456789" 
                  : "https://fantasy.espn.com/football/league?leagueId=123456"
                }
                value={leagueUrl}
                onChange={handleUrlPaste}
                className="url-input"
              />
              {parseLeagueUrl(leagueUrl) && (
                <div className="auto-detected">
                  ✅ Auto-detected: {platform.toUpperCase()} League {leagueId}
                </div>
              )}
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); testConnection(); }} className="setup-form">
              <div className="form-group">
                <label>League ID</label>
                <input
                  type="text"
                  placeholder="Enter your league ID"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  required
                />
                <small>Find this in your league URL</small>
              </div>

              {platform === 'espn' ? (
                <>
                  <div className="espn-warning">
                    <h4>⚠️ ESPN Private League Setup</h4>
                    <p>For private ESPN leagues, we need your browser cookies. Don't worry - we'll walk you through it!</p>
                    
                    <details className="cookie-guide">
                      <summary>📖 How to get your ESPN cookies (click to expand)</summary>
                      <div className="cookie-steps">
                        <ol>
                          <li>Open ESPN Fantasy in a new tab</li>
                          <li>Make sure you're logged in</li>
                          <li>Press <kbd>F12</kbd> to open Developer Tools</li>
                          <li>Click the <strong>Application</strong> tab</li>
                          <li>In the left sidebar, expand <strong>Cookies</strong> → <strong>https://fantasy.espn.com</strong></li>
                          <li>Find <code>espn_s2</code> and copy its value</li>
                          <li>Find <code>SWID</code> and copy its value (include the { } brackets)</li>
                        </ol>
                        <div className="cookie-video">
                          <button type="button" onClick={() => window.open('https://www.youtube.com/watch?v=example', '_blank')}>
                            🎥 Watch Video Guide
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className="form-group">
                    <label>ESPN S2 Cookie</label>
                    <input
                      type="password"
                      placeholder="Paste your espn_s2 cookie value here"
                      value={espnS2}
                      onChange={(e) => setEspnS2(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>ESPN SWID Cookie</label>
                    <input
                      type="text"
                      placeholder="Paste your SWID cookie (with { } brackets)"
                      value={espnSwid}
                      onChange={(e) => setEspnSwid(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Your Sleeper User ID</label>
                  <input
                    type="text"
                    placeholder="Enter your Sleeper user ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    required
                  />
                  <small>Find this in Sleeper app: Settings → Account → User ID</small>
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <div className="button-group">
                <button type="button" onClick={() => setStep(1)} className="back-button">
                  ← Back
                </button>
                <button type="submit" disabled={loading} className="test-button">
                  {loading ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="step-content">
            <h2>Step 3: Confirm & Complete</h2>
            <div className="success-message">
              ✅ Connection successful! We found your league.
            </div>
            
            <div className="league-preview">
              <h3>League Details</h3>
              <p><strong>Platform:</strong> {platform.toUpperCase()}</p>
              <p><strong>League ID:</strong> {leagueId}</p>
              {/* Add league name and other details from test response */}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="notification-preferences">
                <h4>Notification Preferences</h4>
                <label>
                  <input type="checkbox" defaultChecked />
                  Daily lineup recommendations
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  Injury alerts
                </label>
                <label>
                  <input type="checkbox" />
                  Waiver wire suggestions
                </label>
              </div>

              <button type="submit" disabled={loading} className="complete-button">
                {loading ? 'Setting up...' : 'Complete Setup 🚀'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Setup;
