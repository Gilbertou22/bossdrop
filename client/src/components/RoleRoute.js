import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Spin } from 'antd';
import logger from '../utils/logger';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const RoleRoute = ({ children, allowedRoles, mustChangePasswordRedirect }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        // 不在 /register 和 /login 路由中檢查 token
        if (location.pathname === '/register' || location.pathname === '/login') {
            setIsAuthenticated(false);
            setLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            setIsAuthenticated(false);
            setLoading(false);
            return;
        }

        const fetchUser = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/users/me`, {
                    headers: { 'x-auth-token': token },
                });
                setUser(res.data);
                setIsAuthenticated(true);
            } catch (err) {
                logger.error('Fetch user error:', err.response?.data || err.message);
                localStorage.removeItem('token');
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [location]);

    if (loading) {
        return <Spin spinning={true} tip="檢查權限中..." style={{ display: 'block', textAlign: 'center', marginTop: '20%' }} />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (mustChangePasswordRedirect && user.mustChangePassword) {
        return <Navigate to="/change-password" replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default RoleRoute;