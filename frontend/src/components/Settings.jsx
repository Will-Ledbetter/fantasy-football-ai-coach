import React, { useState, useEffect, useCallback } from 'react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { awsConfig } from '../aws-config';
import './Settings.css';

const APP_VERSION = '1.2.0';

function Settings({ user, onChangeLeague, onSignOut, onBack }) {
  const [config, setConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [preferences, setPreferences] = useState({
    pushEnabled: false,
    emailEnabled: false,
    dailyAnalysis: false,
    injuryAlerts: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rulebook, setRulebook] = useState('');
  const [rulebookSaving, setRulebookSaving] = useState(false);
  const [rulebookSaved, setRulebookSaved] = useState(false);

  async function getToken() {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      // Fetch config and subscription independently — one failure shouldn't block the other
      try {
        const configRes = await fetch(`${awsConfig.apiEndpoint}/user/config`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          if (configData.rulebook) setRulebook(configData.rulebook);
          if (configData.preferences) {
            setPreferences({
              pushEnabled: configData.preferences.pushEnabled ?? false,
              emailEnabled: configData.preferences.emailEnabled ?? false,
              dailyAnalysis: configData.preferences.dailyAnalysis ?? false,
              injuryAlerts: configData.preferences.injuryAlerts ?? false,
            });
          }
        }
      } catch (err) {
        console.error('Config load error:', err);
      }

      try {
        const subRes = await fetch(`${awsConfig.apiEndpoint}/user/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (subRes.ok) {
          setSubscription(await subRes.json());
        }
      } catch (err) {
        console.error('Subscription load error:', err);
      }
    } catch (err) {
      console.error('Settings auth error:', err);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updatePreference(key, value) {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      const token = await getToken();
      const res = await fetch(`${awsConfig.apiEndpoint}/user/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        // Revert on failure
        setPreferences(preferences);
      }
    } catch {
      setPreferences(preferences);
    }
  }

  async function saveRulebook() {
    setRulebookSaving(true);
    setRulebookSaved(false);
    try {
      const token = await getToken();
      const res = await fetch(`${awsConfig.apiEndpoint}/user/rulebook`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rulebook })
      });
      if (res.ok) setRulebookSaved(true);
    } catch (err) {
      console.error('Rulebook save error:', err);
    } finally {
      setRulebookSaving(false);
      setTimeout(() => setRulebookSaved(false), 3000);
    }
  }

  async function handleDowngrade() {
    try {
      const token = await getToken();
      const res = await fetch(`${awsConfig.apiEndpoint}/user/subscription/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSubscription(await res.json());
      }
    } catch (err) {
      console.error('Downgrade error:', err);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${awsConfig.apiEndpoint}/user/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await signOut();
        if (onSignOut) onSignOut();
      } else {
        alert('Failed to delete account. Please try again.');
      }
    } catch (err) {
      console.error('Delete account error:', err);
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    if (onSignOut) onSignOut();
  }

  const tier = subscription?.tier || 'free';
  const subStatus = subscription?.status || 'none';
  const isPaid = tier !== 'free' && subStatus === 'active';
  const isCancelled = subStatus === 'cancelled';
  const periodEndDate = subscription?.periodEndDate;

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-page">
        <div className="settings-error">
          <p>{error}</p>
          <button className="btn-retry" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="settings-back" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings-content">
        {/* League Section */}
        <section className="settings-section">
          <h2>League</h2>
          {config && config.leagueId ? (
            <>
              <div className="settings-row">
                <span className="settings-row-label">Platform</span>
                <span className="settings-row-value">{config.platform || '—'}</span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">League ID</span>
                <span className="settings-row-value">{config.leagueId}</span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Connected</span>
                <span className="settings-row-value">
                  {config.updatedAt
                    ? new Date(config.updatedAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <button className="btn-change-league" onClick={onChangeLeague}>
                Change League
              </button>
            </>
          ) : (
            <div className="connect-prompt">
              <p>No league connected yet.</p>
              <button className="btn-connect" onClick={onChangeLeague}>
                Connect a League
              </button>
            </div>
          )}
        </section>

        {/* League Rulebook Section */}
        <section className="settings-section">
          <h2>League Rulebook</h2>
          <p className="settings-hint">Paste your league rules, scoring settings, trade deadlines, keeper rules, etc. This context will be used by the AI advisor and analysis engine.</p>
          <textarea
            className="rulebook-textarea"
            placeholder="Paste your league rules here... e.g. scoring format, roster limits, trade deadlines, keeper rules, draft order, playoff format, etc."
            value={rulebook}
            onChange={e => setRulebook(e.target.value)}
            rows={8}
          />
          <div className="rulebook-actions">
            <button className="btn-save-rulebook" onClick={saveRulebook} disabled={rulebookSaving}>
              {rulebookSaving ? 'Saving...' : rulebookSaved ? 'Saved!' : 'Save Rulebook'}
            </button>
            {rulebook && <span className="rulebook-count">{rulebook.length.toLocaleString()} chars</span>}
          </div>
        </section>

        {/* Subscription Section */}
        <section className="settings-section">
          <h2>Subscription</h2>
          <div className="settings-row">
            <span className="settings-row-label">Current Tier</span>
            <span className={`tier-badge ${tier}`}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </span>
          </div>

          {isCancelled && periodEndDate && (
            <div className="period-end-notice">
              Active until {new Date(periodEndDate).toLocaleDateString()}
            </div>
          )}

          {/* Upgrade options */}
          <div className="upgrade-options">
            {tier !== 'pro' && (
              <div className="upgrade-card">
                <div className="upgrade-info">
                  <span className="upgrade-tier">Pro Season Pass</span>
                  <span className="upgrade-price">$14.99/season</span>
                  <span className="upgrade-features">Unlimited analysis, unlimited leagues — full NFL season</span>
                </div>
                <button className="btn-upgrade">Upgrade</button>
              </div>
            )}
          </div>

          {isPaid && (
            <button className="btn-downgrade" onClick={handleDowngrade}>
              Downgrade to Free
            </button>
          )}
        </section>

        {/* Account Section */}
        <section className="settings-section">
          <h2>Account</h2>
          <div className="account-actions">
            <button className="btn-signout" onClick={handleSignOut}>
              Sign Out
            </button>
            <button className="btn-delete" onClick={() => setShowDeleteConfirm(true)}>
              Delete Account
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section">
          <h2>About</h2>
          <p className="about-row">Helix Sideline v{APP_VERSION}</p>
          <p className="about-row">Developed by Helix Astra</p>
        </section>

        {/* Legal Section */}
        <section className="settings-section">
          <h2>Legal</h2>
          <a href="https://helixastra.com/eula.html" target="_blank" rel="noopener noreferrer" className="settings-link">Terms of Use (EULA)</a>
          <a href="https://helixastra.com/privacy.html" target="_blank" rel="noopener noreferrer" className="settings-link">Privacy Policy</a>
          <a href="https://helixastra.com/cookies.html" target="_blank" rel="noopener noreferrer" className="settings-link">Cookie Policy</a>
        </section>
      </div>

      {/* Delete Account Confirmation */}
      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Account?</h3>
            <p>This will permanently delete your account and all associated data. This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm-delete" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
