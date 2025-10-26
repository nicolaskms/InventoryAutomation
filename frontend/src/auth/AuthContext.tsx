import React, { createContext, useContext, useEffect, useState } from 'react';
import credentials from '../config/credentials.json';

type User = {
  email: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('app_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user;

  useEffect(() => {
    if (user) localStorage.setItem('app_auth_user', JSON.stringify(user));
    else localStorage.removeItem('app_auth_user');
  }, [user]);

  async function login(email: string, password: string) {
    // credenciais estáticas do arquivo JSON
    // Requer tsconfig com "resolveJsonModule": true
    if (email === credentials.email && password === credentials.password) {
      setUser({ email });
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}