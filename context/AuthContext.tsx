'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type User = { id: number; email: string; balance: number } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
};


const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  isLoading: true,
  refreshUser: async () => {}, // <-- REQUIRED FIX
});


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
  if (!token) return;

  const interval = setInterval(async () => {
    const res = await fetch("/api/auth/me/", {    // ← IMPORTANT SLASH
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [token]);



  useEffect(() => {
    // Load token from localStorage on mount
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);
  const refreshUser = async () => {
  if (!token) return;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  } catch (err) {
    console.error('Failed to refresh user:', err);
  }
};

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json();
    
    if (data.success) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      throw new Error(data.error || 'Login failed');
    }
  };

  const signup = async (email: string, password: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await res.json();
    
    if (data.success) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      throw new Error(data.error || 'Signup failed');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
