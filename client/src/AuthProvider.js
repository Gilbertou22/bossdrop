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
       
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
       
            setUser(res.data);
            setIsAuthenticated(true);
        } catch (err) {
            console.error('Fetch user error:', err);
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const initializeUser = async () => {
        setLoading(true);
        const storedToken = localStorage.getItem('token');

        if (storedToken) {
            await fetchUser(storedToken);
        } else {
            setIsAuthenticated(false);
            setToken(null);
            setUser(null);
            setLoading(false);
        }
    };

    useEffect(() => {
        initializeUser();
    }, []); // 初始加載時執行

    // 監聽 token 變化以重新加載用戶
    useEffect(() => {
        if (token && !user) {
        
            fetchUser(token);
        }
    }, [token]);

    const login = (userData, newToken) => {
        
        localStorage.setItem('token', newToken); // 確保 token 存入 localStorage
        setToken(newToken); // 更新 token 狀態
        setUser(userData); // 更新 user 狀態
        setIsAuthenticated(true); // 更新 isAuthenticated 狀態
    };

    const logout = async () => {
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

    // Axios 攔截器保持不變
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401 && isAuthenticated) {
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
    }, [isAuthenticated, token, logout]);

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);