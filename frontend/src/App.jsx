import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import Dashboard from './components/Dashboard';
import DraftRoom from './components/DraftRoom';
import FPLDraftRoom from './components/FPLDraftRoom';
import FPLCommandCenter from './components/FPLCommandCenter';
import Login from './components/Login';
import Setup from './components/Setup';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasLeague, setHasLeague] = useState(false);
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      // Attempt to restore/refresh the session first. If the access token has
      // expired but a valid refresh token exists, this keeps the user signed in.
      const session = await fetchAuthSession();
      if (!session.tokens) throw new Error('No valid session');

      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Check if user has league configured
      const hasConfig = await checkLeagueConfig(currentUser.username);
      setHasLeague(hasConfig);
    } catch (error) {
      console.log('Not authenticated', error);
      setUser(null);
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

  function handleSignOut() {
    setUser(null);
    setView('dashboard');
  }

  function handleChangeLeague() {
    setHasLeague(false);
    setView('dashboard');
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
    return <Setup user={user} onComplete={() => { setHasLeague(true); setView('dashboard'); }} />;
  }

  if (view === 'settings') {
    return (
      <Settings
        user={user}
        onChangeLeague={handleChangeLeague}
        onSignOut={handleSignOut}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'nfl-draft') {
    return <DraftRoom user={user} onBack={() => setView('dashboard')} />;
  }

  if (view === 'fpl-draft') {
    return <FPLDraftRoom user={user} onBack={() => setView('dashboard')} />;
  }

  if (view === 'fpl-center') {
    return <FPLCommandCenter user={user} onBack={() => setView('dashboard')} />;
  }

  return (
    <Dashboard 
      user={user} 
      onNavigateToSettings={() => setView('settings')} 
      onNavigateToDraft={() => setView('nfl-draft')}
      onNavigateToFPL={() => setView('fpl-draft')}
      onNavigateToFPLCenter={() => setView('fpl-center')}
    />
  );
}

export default App;
