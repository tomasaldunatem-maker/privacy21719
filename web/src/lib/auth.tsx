import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export type Role = 'ADMIN' | 'DPO' | 'STAFF' | 'VIEWER';
export interface Me {
  user: { id: string; email: string; name: string; role: Role; organizationId: string; mustChangePassword: boolean };
  organization: { id: string; name: string; slug: string; rut: string | null; address: string | null; privacyEmail: string | null; privacyOfficer: string | null };
}
interface Ctx { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }
const AuthCtx = createContext<Ctx>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setMe(await api<Me>('/auth/me')); } catch { setMe(null); } finally { setLoading(false); }
  }, []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setMe(null); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => setMe(null);
    window.addEventListener('p21719:unauthorized', h);
    return () => window.removeEventListener('p21719:unauthorized', h);
  }, []);
  return <AuthCtx.Provider value={{ me, loading, refresh, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/** Permisos en la interfaz (el backend los vuelve a validar siempre). */
export function usePerms() {
  const r = useAuth().me?.user.role;
  return {
    role: r,
    isAdmin: r === 'ADMIN',
    canManage: r === 'ADMIN' || r === 'DPO',
    canOperate: r === 'ADMIN' || r === 'DPO' || r === 'STAFF',
  };
}
