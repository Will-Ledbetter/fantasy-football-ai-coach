import React, { useState, useEffect } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import './Dashboard.css';

function Dashboard({ user }) {
  const [analysis, setAnalysis] = useState(null);
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [userConfig, setUserConfig] = useState(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadUserConfig();
  }, []);

  async function loadDashboard() {
    try {
      // Get auth token
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch latest analysis
      const analysisResponse = await fetch('https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/analysis/latest', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const analysisData = await analysisResponse.json();
      setAnalysis(analysisData);

      // Fetch current roster
      const rosterResponse = await fetch('https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/roster', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const rosterData = await rosterResponse.json();
      setRoster(rosterData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Set empty data so UI still renders
      setAnalysis({ recommendations: [], message: 'Unable to load analysis' });
      setRoster({ starters: [], bench: [], message: 'Unable to load roster' });
    } finally {
      setLoading(false);
    }
  }

  async function loadUserConfig() {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch('https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/user/config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const config = await response.json();
        setUserConfig(config);
      }
    } catch (error) {
      console.error('Error loading user config:', error);
    }
  }

  async function runAnalysis() {
    setAnalysisRunning(true);
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('https://pv4kpd7p75.execute-api.us-east-1.amazonaws.com/dev/analysis/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        // Poll for results after a short delay
        setTimeout(() => {
          loadDashboard();
        }, 3000);
        
        // Show success message
        console.log('Analysis started:', result.message);
      } else {
        throw new Error(result.error || 'Failed to start analysis');
      }

    } catch (error) {
      console.error('Error running analysis:', error);
      alert('Failed to run analysis. Please try again.');
    } finally {
      setAnalysisRunning(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  if (loading) {
    return <div className="loading">Loading your analysis...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🏈 Fantasy Football AI Coach</h1>
        <div className="user-info">
          <span>{user?.username || user?.signInDetails?.loginId || 'User'}</span>
          <button onClick={() => setShowSettings(true)} className="btn btn-secondary">
            ⚙️ Settings
          </button>
          <button onClick={handleSignOut} className="btn btn-secondary">
            Sign Out
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>League Settings</h2>
            {userConfig ? (
              <div className="settings-info">
                <div className="setting-item">
                  <strong>Platform:</strong> {userConfig.platform.toUpperCase()}
                </div>
                <div className="setting-item">
                  <strong>League ID:</strong> {userConfig.leagueId}
                </div>
                {userConfig.platformUserId && (
                  <div className="setting-item">
                    <strong>User ID:</strong> {userConfig.platformUserId}
                  </div>
                )}
                <div className="setting-item">
                  <strong>Last Updated:</strong> {new Date(userConfig.updatedAt).toLocaleDateString()}
                </div>
                <p className="settings-note">
                  To change your league settings, please sign out and set up again with new credentials.
                </p>
              </div>
            ) : (
              <p>Loading settings...</p>
            )}
            <button onClick={() => setShowSettings(false)} className="btn btn-primary">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        {/* Welcome Message */}
        <section className="welcome-section card">
          <h2>Welcome to Your Fantasy Football AI Coach! 🎉</h2>
          <p>Your league has been connected successfully. Here's what you can do:</p>
          <ul>
            <li>🏈 <strong>On-Demand Analysis:</strong> Click "Run Analysis" to get AI-powered roster insights</li>
            <li>📊 <strong>Detailed Breakdowns:</strong> Get player-specific recommendations and matchup analysis</li>
            <li>🏆 <strong>Smart Insights:</strong> Receive sit/start advice, waiver wire targets, and trade suggestions</li>
            <li>⚔️ <strong>Head-to-Head Strategy:</strong> Get opponent-specific game plans and lineup optimization</li>
          </ul>
          <p className="info-box">
            💡 <strong>Get Started:</strong> Click the "Run Analysis" button below to generate your first personalized fantasy football report!
          </p>
        </section>

        {/* Analysis Control Section */}
        <section className="analysis-control-section">
          <div className="analysis-header">
            <h2>Fantasy Analysis</h2>
            <button 
              onClick={runAnalysis} 
              disabled={analysisRunning}
              className={`btn btn-primary analysis-btn ${analysisRunning ? 'running' : ''}`}
            >
              {analysisRunning ? '🔄 Running Analysis...' : '🏈 Run Analysis'}
            </button>
          </div>
          {analysis?.lastUpdated && (
            <p className="last-updated">
              Last updated: {new Date(analysis.lastUpdated).toLocaleString()}
            </p>
          )}
        </section>

        {/* Recommendations Section */}
        <section className="recommendations-section">
          <h2>Today's Recommendations</h2>
          {analysis?.recommendations?.length > 0 ? (
            <div className="recommendations-list">
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className={`recommendation ${rec.priority}`}>
                  <div className="rec-header">
                    <span className="rec-type">{rec.type.replace('_', ' ')}</span>
                    <span className="rec-priority">{rec.priority}</span>
                  </div>
                  <p className="rec-text">{rec.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-recommendations">
              <p>{analysis?.message || 'Click "Run Analysis" to get personalized recommendations for your roster!'}</p>
              {!analysis && (
                <button 
                  onClick={runAnalysis} 
                  disabled={analysisRunning}
                  className="btn btn-primary"
                >
                  {analysisRunning ? 'Running...' : 'Get Started'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Full Analysis Section */}
        {analysis?.analysis && (
          <section className="analysis-section">
            <h2>Full AI Analysis</h2>
            <div className="analysis-content">
              <pre>{analysis.analysis}</pre>
            </div>
          </section>
        )}


      </div>
    </div>
  );
}

export default Dashboard;
