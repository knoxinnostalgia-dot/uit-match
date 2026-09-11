import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { Meta, OwnProfile } from './types';

interface AuthValue {
  ready: boolean;
  signedIn: boolean;
  profile: OwnProfile | null;
  email: string | null;
  meta: Meta | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: OwnProfile) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

type SessionResponse = { token?: string; user: { id: number; email: string }; profile: OwnProfile | null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));
  const [profile, setProfileState] = useState<OwnProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  const applySession = useCallback((data: SessionResponse) => {
    if (data.token) setToken(data.token);
    setEmail(data.user.email);
    setProfileState(data.profile);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    api<Meta>('/api/meta').then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<SessionResponse>('/api/auth/me')
      .then(applySession)
      .catch(() => {
        setToken(null);
        setSignedIn(false);
      })
      .finally(() => setReady(true));
  }, [applySession]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      signedIn,
      profile,
      email,
      meta,
      signIn: async (e, password) => {
        applySession(await api<SessionResponse>('/api/auth/login', { method: 'POST', body: { email: e, password } }));
      },
      signUp: async (e, password) => {
        applySession(await api<SessionResponse>('/api/auth/signup', { method: 'POST', body: { email: e, password } }));
      },
      signOut: async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        setToken(null);
        setSignedIn(false);
        setProfileState(null);
        setEmail(null);
      },
      refreshProfile: async () => {
        const data = await api<{ profile: OwnProfile }>('/api/profile/me');
        setProfileState(data.profile);
      },
      setProfile: setProfileState,
    }),
    [ready, signedIn, profile, email, meta, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
