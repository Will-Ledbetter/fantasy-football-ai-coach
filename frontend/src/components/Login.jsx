import React, { useState } from 'react';
import { signIn, signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import './Login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (needsVerification) {
        // Verify the code
        await confirmSignUp({
          username: email,
          confirmationCode: verificationCode
        });
        setNeedsVerification(false);
        setIsSignUp(false);
        alert('Email verified! You can now sign in.');
        setVerificationCode('');
      } else if (isSignUp) {
        await signUp({
          username: email,
          password: password,
          options: {
            userAttributes: { email: email }
          }
        });
        setNeedsVerification(true);
      } else {
        await signIn({ username: email, password });
        onLogin();
      }
    } catch (err) {
      const errorMessage = err.message || 'An error occurred';
      console.error('Auth error:', err);
      
      // Handle different error cases
      if (isSignUp && (errorMessage.includes('already exists') || errorMessage.includes('UsernameExistsException'))) {
        // Check if it's an unverified account
        if (errorMessage.includes('not confirmed') || errorMessage.includes('User is not confirmed')) {
          setError('This account exists but needs verification. Click "Resend Code" below.');
          setNeedsVerification(true);
        } else {
          // Account exists and is verified - tell them to sign in
          setError('This account already exists. Please sign in instead.');
          setIsSignUp(false);
        }
      } else if (!isSignUp && errorMessage.includes('not confirmed')) {
        // Trying to sign in but not verified
        setError('Please verify your email first. Click "Resend Code" below.');
        setNeedsVerification(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError('');
    setLoading(true);
    try {
      await resendSignUpCode({ username: email });
      alert('Verification code sent! Check your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🏈</h1>
          <h2>Fantasy Football AI Coach</h2>
          <p>Get AI-powered lineup recommendations daily</p>
        </div>

        <h3 className="form-title">
          {needsVerification ? 'Verify Email' : (isSignUp ? 'Create Account' : 'Sign In')}
        </h3>

        {needsVerification && (
          <p className="verification-message">
            We sent a verification code to <strong>{email}</strong>. Please enter it below.
          </p>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {needsVerification ? (
            <>
              <input
                type="text"
                placeholder="Verification Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                maxLength={6}
              />
              <p className="password-hint">Check your email for the 6-digit code</p>
            </>
          ) : (
            <>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />

              {isSignUp && (
                <p className="password-hint">Password must be at least 8 characters</p>
              )}
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Loading...' : (needsVerification ? 'Verify Email' : (isSignUp ? 'Create Account' : 'Sign In'))}
          </button>
        </form>

        <div className="login-footer">
          {needsVerification ? (
            <>
              <button 
                className="resend-code-btn"
                onClick={handleResendCode}
                type="button"
                disabled={loading}
              >
                Resend Code
              </button>
              <button 
                className="toggle-mode"
                onClick={() => {
                  setNeedsVerification(false);
                  setIsSignUp(false);
                  setVerificationCode('');
                  setError('');
                }}
                type="button"
              >
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <p>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              </p>
              <button 
                className="toggle-mode"
                onClick={() => setIsSignUp(!isSignUp)}
                type="button"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
