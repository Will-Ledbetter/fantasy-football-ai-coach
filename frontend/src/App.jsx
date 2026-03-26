import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Setup from './components/Setup';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasLeague, setHasLeague] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Check if user has league configured
      const hasConfig = await checkLeagueConfig(currentUser.username);
      setHasLeague(hasConfig);
    } catch (error) {
      console.log('Not authenticated', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkLeagueConfig(userId) {
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
        return config && config.leagueId;
      }
      return false;
    } catch (error) {
      console.log('No league config found:', error);
      return false;
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={checkUser} />;
  }

  if (!hasLeague) {
    return <Setup user={user} onComplete={() => setHasLeague(true)} />;
  }

  return <Dashboard user={user} />;
}

export default App;
