import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    console.log('PrivateRoute checked, token:', token); // 調試
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

export default PrivateRoute;