import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import logger from './utils/logger';

export const AuthContext = createContext();

const BASE_URL = process.env.REACT_APP_API_URL || '';

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async (token) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/auth/user`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetch User Response:', res.data);
            return res.data.user;
        } catch (err) {
            logger.error('Fetch user error:', { error: err.response?.data || err.message });
            return null;
        }
    };

    const initializeUser = async () => {
        console.log('Executing initializeUser');
        setLoading(true);
        const storedToken = localStorage.getItem('token');
        console.log('Stored Token:', storedToken);
        if (storedToken) {
            const userData = await fetchUser(storedToken);
            console.log('Fetched User Data:', userData);
            if (userData) {
                setToken(storedToken);
                setUser(userData);
                setIsAuthenticated(true);
            } else {
                console.log('User data fetch failed, maintaining current state');
                // Do not reset state immediately; keep current token and user
                // This prevents unnecessary redirect if the user is already authenticated
                if (!isAuthenticated) {
                    setIsAuthenticated(false);
                    setToken(null);
                    setUser(null);
                }
            }
        } else {
            console.log('No token found, resetting state');
            setIsAuthenticated(false);
            setToken(null);
            setUser(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        initializeUser();

        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401 && isAuthenticated) {
                    // Avoid logout for initial requests
                    if (
                        error.config.url.includes('/api/session/menu') ||
                        error.config.url.includes('/api/notifications') ||
                        error.config.url.includes('/api/auth/user') ||
                        error.config.url.includes('/api/auctions/pending-count') ||
                        error.config.url.includes('/api/users') ||
                        error.config.url.includes('/api/boss-kills') ||
                        error.config.url.includes('/api/applications') ||
                        error.config.url.includes('/api/auctions') ||
                        error.config.url.includes('/api/stats') ||
                        error.config.url.includes('/api/bosses') ||
                        error.config.url.includes('/api/items') ||
                        error.config.url.includes('/api/pending') ||
                        error.config.url.includes('/api/alerts') ||
                        error.config.url.includes('/api/guilds') ||
                        error.config.url.includes('/api/attendee-requests') ||
                        error.config.url.includes('/api/logs') ||
                        error.config.url.includes('/api/wallet') ||
                        error.config.url.includes('/api/dkp') ||
                        error.config.url.includes('/api/item-levels')
                    ) {
                        console.warn('Ignoring 401 for initial request:', error.config.url);
                        return Promise.reject(error);
                    }
                    console.error('Triggering logout due to 401 error:', {
                        url: error.config.url,
                        response: error.response?.data,
                    });
                    logout();
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const login = async (credentials) => {
        try {
            const res = await axios.post(`${BASE_URL}/api/auth/login`, credentials, {
                withCredentials: true,
            });
            const { token, user } = res.data;
            console.log('Login Response:', res.data);
            localStorage.setItem('token', token);
            setToken(token);
            setUser(user);
            setIsAuthenticated(true);
            return true;
        } catch (err) {
            logger.error('Login error:', { error: err.response?.data || err.message });
            throw err;
        }
    };

    const logout = async () => {
        console.log('Executing logout');
        try {
            await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
                headers: { 'x-auth-token': token },
            });
        } catch (err) {
            logger.error('Logout error:', { error: err.message });
        } finally {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);