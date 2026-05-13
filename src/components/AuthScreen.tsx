import { FormEvent, useState } from 'react';
import { supabase } from '../supabaseClient';

interface AuthScreenProps {
  onGuestContinue: () => void;
}

function AuthScreen({ onGuestContinue }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (err) throw err;
        if (!data.session) {
          setConfirmationPending(true);
          setMode(null);
        }
        // Session exists → App's onAuthStateChange handles the rest
      } else if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // App's onAuthStateChange handles the rest
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const back = () => { setMode(null); setError(''); };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card auth-card">
        <h1 className="onboarding-title">Budget Manager</h1>

        {confirmationPending && (
          <div className="auth-confirmation-notice">
            Account created! Check your email for a confirmation link, then sign in.
          </div>
        )}

        {mode === null ? (
          <div className="auth-options">
            <button type="button" className="primary-button auth-button" onClick={() => setMode('signin')}>
              Sign In
            </button>
            <button type="button" className="primary-button auth-button" onClick={() => setMode('signup')}>
              Sign Up
            </button>
            <button type="button" className="secondary-button auth-button" onClick={onGuestContinue}>
              Continue as Guest
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <h2>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>
            {error && <div className="error-message">{error}</div>}
            {mode === 'signup' && (
              <label>
                Username
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
              <button type="button" className="secondary-button" disabled={loading} onClick={back}>
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthScreen;
