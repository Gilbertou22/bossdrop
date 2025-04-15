import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../AuthProvider';

const RoleRoute = ({ children, allowedRoles, mustChangePasswordRedirect }) => {
    const { user, isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="載入中..." />
            </div>
        );
    }

    // 不在 /register 和 /login 路由中檢查認證
    if (location.pathname === '/register' || location.pathname === '/login') {
        return children;
    }

    if (!isAuthenticated || !user) {
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