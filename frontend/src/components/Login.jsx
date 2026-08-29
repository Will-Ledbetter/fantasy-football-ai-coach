import React, { useState } from 'react';
import { signIn, signUp, confirmSignUp, resendSignUpCode, signOut, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import './Login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mode, setMode] = useState('signIn');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'verify') {
        await confirmSignUp({ username: email, confirmationCode: code });
        setMode('signIn');
        alert('Email verified. You can now sign in.');
      } else if (mode === 'forgotPassword') {
        await resetPassword({ username: email });
        setMode('resetPassword');
        alert('Check your email for the reset code.');
      } else if (mode === 'resetPassword') {
        await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
        setMode('signIn');
        setCode(''); setNewPassword('');
        alert('Password reset. Sign in with your new password.');
      } else if (mode === 'signUp') {
        await signUp({ username: email, password, options: { userAttributes: { email } } });
        setMode('verify');
      } else {
        try { await signOut({ global: false }); } catch {}
        await signIn({ username: email, password, options: { authFlowType: 'USER_PASSWORD_AUTH' } });
        onLogin();
      }
    } catch (err) {
      const msg = err.message || err.name || 'Something went wrong';
      if (msg.includes('not confirmed')) { setMode('verify'); setError('Please verify your email first.'); }
      else if (msg.includes('already exists')) { setError('Account exists. Try signing in.'); setMode('signIn'); }
      else if (msg.includes('Incorrect') || msg.includes('NotAuthorized')) { setError('Incorrect email or password.'); }
      else { setError(msg); }
    } finally { setLoading(false); }
  }

  async function handleResend() {
    try { await resendSignUpCode({ username: email }); alert('Code sent. Check your email.'); }
    catch (err) { setError(err.message || 'Failed to resend'); }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.png" alt="Helix Sideline" className="login-logo" />
        <p className="login-subtitle">AI powered live Fantasy Football Coaching and Lineup Recommendations</p>

        <h3 className="form-title">
          {mode === 'verify' ? 'Verify Email' : mode === 'signUp' ? 'Create Account' : mode === 'forgotPassword' ? 'Forgot Password' : mode === 'resetPassword' ? 'Reset Password' : 'Sign In'}
        </h3>

        <form onSubmit={handleSubmit}>
          {mode === 'forgotPassword' ? (
            <>
              <p className="hint">Enter your email and we'll send a reset code</p>
              <input type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </>
          ) : mode === 'resetPassword' ? (
            <>
              <p className="hint">Enter the code sent to {email} and your new password</p>
              <input type="text" placeholder="Reset Code" value={code}
                onChange={(e) => setCode(e.target.value)} maxLength={6} required />
              <input type="password" placeholder="New Password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </>
          ) : mode === 'verify' ? (
            <>
              <p className="hint">Enter the 6-digit code sent to {email}</p>
              <input type="text" placeholder="Verification Code" value={code}
                onChange={(e) => setCode(e.target.value)} maxLength={6} required />
            </>
          ) : (
            <>
              <input type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              {mode === 'signUp' && <p className="hint">Password must be at least 8 characters</p>}
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Loading...' : mode === 'verify' ? 'Verify' : mode === 'signUp' ? 'Create Account' : mode === 'forgotPassword' ? 'Send Reset Code' : mode === 'resetPassword' ? 'Reset Password' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          {mode === 'verify' ? (
            <>
              <button className="link-btn" onClick={handleResend}>Resend Code</button>
              <button className="link-btn" onClick={() => { setMode('signIn'); setError(''); }}>Back to Sign In</button>
            </>
          ) : (
            <>
              <button className="link-btn" onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(''); }}>
                {mode === 'signIn' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
              {mode === 'signIn' && (
                <button className="link-btn" onClick={() => { setMode('forgotPassword'); setError(''); }}>
                  Forgot Password?
                </button>
              )}
              {(mode === 'forgotPassword' || mode === 'resetPassword') && (
                <button className="link-btn" onClick={() => { setMode('signIn'); setError(''); }}>
                  Back to Sign In
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
