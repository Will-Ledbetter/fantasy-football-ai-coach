import React, { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

function SleeperOAuth({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [step, setStep] = useState(1); // 1: auth, 2: select league

  useEffect(() => {
    // Check if we're returning from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, []);

  async function startSleeperOAuth() {
    setLoading(true);
    
    try {
      // Generate state for security
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('sleeper_oauth_state', state);
      
      // Sleeper OAuth URL (Note: Sleeper doesn't have public OAuth yet, this is conceptual)
      // In reality, you'd need to apply for Sleeper API access
      const clientId = process.env.REACT_APP_SLEEPER_CLIENT_ID;
      const redirectUri = encodeURIComponent(window.location.origin + '/setup');
      const scope = 'read';
      
      const oauthUrl = `https://sleeper.app/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
      
      // Redirect to Sleeper OAuth
      window.location.href = oauthUrl;
      
    } catch (error) {
      setLoading(false);
      onError('Failed to start OAuth process: ' + error.message);
    }
  }

  async function handleOAuthCallback(code, state) {
    setLoading(true);
    
    try {
      // Verify state
      const savedState = localStorage.getItem('sleeper_oauth_state');
      if (state !== savedState) {
        throw new Error('Invalid OAuth state');
      }
      
      // Exchange code for access token
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      const response = await fetch('https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/oauth/sleeper/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, state })
      });
      
      if (!response.ok) {
        throw new Error('OAuth callback failed');
      }
      
      const result = await response.json();
      
      // Show league selection
      setLeagues(result.leagues);
      setStep(2);
      
      // Clean up
      localStorage.removeItem('sleeper_oauth_state');
      window.history.replaceState({}, document.title, window.location.pathname);
      
    } catch (error) {
      onError('OAuth callback failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectLeague() {
    if (!selectedLeague) return;
    
    setLoading(true);
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      const response = await fetch('https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/oauth/sleeper/select-league', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leagueId: selectedLeague })
      });
      
      if (!response.ok) {
        throw new Error('Failed to select league');
      }
      
      onSuccess();
      
    } catch (error) {
      onError('Failed to select league: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 2) {
    return (
      <div className="sleeper-oauth">
        <div className="oauth-success">
          <div className="success-icon">✅</div>
          <h3>Connected to Sleeper!</h3>
          <p>Select which league you'd like to use:</p>
        </div>
        
        <div className="league-selector">
          {leagues.map(league => (
            <div 
              key={league.league_id}
              className={`league-option ${selectedLeague === league.league_id ? 'selected' : ''}`}
              onClick={() => setSelectedLeague(league.league_id)}
            >
              <div className="league-info">
                <h4>{league.name}</h4>
                <p>{league.total_rosters} teams • {league.season} season</p>
                <p className="league-status">
                  {league.status === 'in_season' ? '🏈 Active' : 
                   league.status === 'pre_draft' ? '📅 Pre-Draft' : 
                   league.status === 'drafting' ? '🎯 Drafting' : 
                   '✅ Complete'}
                </p>
              </div>
              {selectedLeague === league.league_id && (
                <div className="selected-indicator">✓</div>
              )}
            </div>
          ))}
        </div>
        
        <button 
          className="complete-oauth-button"
          onClick={selectLeague}
          disabled={!selectedLeague || loading}
        >
          {loading ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    );
  }

  return (
    <div className="sleeper-oauth">
      <div className="oauth-intro">
        <div className="platform-logo">💤</div>
        <h3>Connect with Sleeper</h3>
        <p>The easiest way to connect your fantasy league</p>
        
        <div className="oauth-benefits">
          <div className="benefit">
            <span className="benefit-icon">🔒</span>
            <span>Secure OAuth - no passwords needed</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">⚡</span>
            <span>Instant setup - no manual IDs</span>
          </div>
          <div className="benefit">
            <span className="benefit-icon">👀</span>
            <span>Read-only access - we can't change anything</span>
          </div>
        </div>
      </div>
      
      <button 
        className="oauth-button"
        onClick={startSleeperOAuth}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Connecting...
          </>
        ) : (
          <>
            <span className="sleeper-icon">💤</span>
            Connect with Sleeper
          </>
        )}
      </button>
      
      <div className="oauth-disclaimer">
        <p>By connecting, you agree to our <a href="/privacy" target="_blank">Privacy Policy</a></p>
        <p>You can revoke access anytime in your Sleeper settings</p>
      </div>
    </div>
  );
}

export default SleeperOAuth;