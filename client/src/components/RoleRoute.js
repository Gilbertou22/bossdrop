import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger'; // 引入前端日誌工具

const RoleRoute = ({ children, allowedRoles }) => {
    const token = localStorage.getItem('token');
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserRole = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await axios.get('http://localhost:5000/api/users/profile', {
                    headers: { 'x-auth-token': token },
                });
                setUserRole(res.data.role);
            } catch (err) {
                console.error('Fetch user role error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchUserRole();
    }, [token]);

    if (loading) return <div>檢查權限中...</div>;
    if (!token || !allowedRoles.includes(userRole)) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

export default RoleRoute;