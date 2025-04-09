import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import logger from './utils/logger';

export const AuthContext = createContext();

const BASE_URL = process.env.REACT_APP_API_URL || '';

const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get(`${BASE_URL}/api/users/me`, {
                headers: {
                    'x-auth-token': token,
                },
            }).then(res => {
                setIsAuthenticated(true);
                setUser(res.data);
                logger.info('User authenticated:', res.data);
            }).catch(err => {
                localStorage.removeItem('token');
                setIsAuthenticated(false);
                setUser(null);
                logger.error('Auth check failed:', err.response?.data || err.message);
            }).finally(() => {
                setLoading(false);
            });
        } else {
            setIsAuthenticated(false);
            setLoading(false);
        }
    }, []);

    const login = (token, user) => {
        localStorage.setItem('token', token);
        setIsAuthenticated(true);
        setUser(user);
        logger.info('User logged in:', user);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        logger.info('User logged out');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;