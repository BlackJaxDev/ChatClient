import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const { signIn, signUp, pending } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      if (mode === 'login') {
        await signIn({ email, password });
      } else {
        await signUp({ email, password, displayName: displayName || undefined });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    }
  };

  const submitDisabled = !email.trim() || !password.trim() || (mode === 'register' && !displayName.trim()) || pending;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Welcome to ChatClient</h1>
        <p className="auth-card__subtitle">
          {mode === 'login' ? 'Sign in to continue the conversation.' : 'Create an account to join the conversation.'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>
          {mode === 'register' && (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
                required
              />
            </label>
          )}
          {error && <div className="auth-form__error">{error}</div>}
          <button type="submit" disabled={submitDisabled}>
            {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="auth-card__switch">
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button type="button" onClick={toggleMode} disabled={pending}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
