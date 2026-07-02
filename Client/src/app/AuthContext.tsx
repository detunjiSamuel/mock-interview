"use client";
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { apiClient, setApiToken } from "@/lib/api-client";

interface User {
  email: string;
  id?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  token: null,
  login: async () => {},
  logout: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sessionRes = await fetch("/api/auth/session").then((r) => r.json());
        const sessionToken: string | null = sessionRes.token ?? null;
        if (sessionToken) {
          setApiToken(sessionToken);
          const profile = await apiClient.get("/api/auth/profile");
          setToken(sessionToken);
          setUser({ email: profile.data.email, id: profile.data.id });
          setIsLoggedIn(true);
        }
      } catch {
        // no valid session
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (newToken: string, email: string) => {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: newToken }),
    });
    setApiToken(newToken);
    setToken(newToken);
    setUser({ email });
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setApiToken(null);
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
