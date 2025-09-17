import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchCurrentUser,
  login,
  logout,
  registerAccount,
  updateProfile as updateProfileRequest,
} from '../api';
import { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  pending: boolean;
  signIn: (credentials: { email: string; password: string }) => Promise<AuthUser>;
  signUp: (payload: { email: string; password: string; displayName?: string }) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  updateProfile: (updates: { displayName?: string; avatarUrl?: string; accentColor?: string }) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runWithPending<T>(operation: () => Promise<T>): Promise<T> {
    setPending(true);
    try {
      return await operation();
    } finally {
      setPending(false);
    }
  }

  const signIn = (credentials: { email: string; password: string }) =>
    runWithPending(async () => {
      const next = await login(credentials);
      setUser(next);
      return next;
    });

  const signUp = (payload: { email: string; password: string; displayName?: string }) =>
    runWithPending(async () => {
      const next = await registerAccount(payload);
      setUser(next);
      return next;
    });

  const signOut = () =>
    runWithPending(async () => {
      await logout();
      setUser(null);
    });

  const refresh = async () => {
    const current = await fetchCurrentUser();
    setUser(current);
    return current;
  };

  const updateProfile = (updates: { displayName?: string; avatarUrl?: string; accentColor?: string }) =>
    runWithPending(async () => {
      const updated = await updateProfileRequest(updates);
      setUser(updated);
      return updated;
    });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      pending,
      signIn,
      signUp,
      signOut,
      refresh,
      updateProfile,
    }),
    [user, initializing, pending]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
