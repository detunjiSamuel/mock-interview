
import React, { createContext, useState, useContext } from 'react';


const MAIN_API_URL = 'http://localhost:8080'

type AuthContextValue = {
 isLoggedIn: boolean;
 login: (token: string, email: string) => void;
 logout: () => void;
};


const initialAuthContextValue: AuthContextValue = {
 isLoggedIn: false,
 login: (token, email) => { },
 logout: () => { },
};

const AuthContext = createContext<AuthContextValue>(initialAuthContextValue);


const AuthProvider = ({ children }) => {
 const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

 const logout = () => {
  localStorage.removeItem('token');
  setIsLoggedIn(false);
 };

 const login = (token: string, email: string) => {
  localStorage.setItem('token', token);
  localStorage.setItem('email', email)
  setIsLoggedIn(true);
 };

 return (
  <AuthContext.Provider value={{ isLoggedIn, logout, login }}>
   {children}
  </AuthContext.Provider>
 );
};

const useAuth = (): AuthContextValue => {
 return useContext(AuthContext);
};

export { AuthProvider, useAuth, MAIN_API_URL };
