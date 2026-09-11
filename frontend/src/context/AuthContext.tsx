import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authApi, setAccessToken, onAuthChange } from '../lib/api';
import type { User, Role } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>;
  register: (payload: Parameters<typeof authApi.register>[0]) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);

  // Bootstrap session: try refresh on first load
  useEffect(() => {
    let cancelled = false;
    const bootstrapVersion = sessionVersion.current;
    (async () => {
      try {
        const { user: me } = await authApi.me();
        if (!cancelled && sessionVersion.current === bootstrapVersion) setUser(me);
      } catch {
        if (!cancelled && sessionVersion.current === bootstrapVersion) setAccessToken(null);
        if (!cancelled && sessionVersion.current === bootstrapVersion) setUser(null);
      } finally {
        if (!cancelled && sessionVersion.current === bootstrapVersion) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sign out locally whenever the token is cleared by the API client
  useEffect(() => {
    const unsubscribe = onAuthChange((token) => {
      if (token === null) setUser(null);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean): Promise<User> => {
    sessionVersion.current += 1;
    setLoading(false);
    const { user: u, accessToken } = await authApi.login(email, password, rememberMe);
    setAccessToken(accessToken);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload: Parameters<typeof authApi.register>[0]): Promise<User> => {
    sessionVersion.current += 1;
    setLoading(false);
    const { user: u, accessToken } = await authApi.register(payload);
    setAccessToken(accessToken);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    sessionVersion.current += 1;
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const hasRole = useCallback((...roles: Role[]) => (user ? roles.includes(user.role) : false), [user]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, hasRole }),
    [user, loading, login, register, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
