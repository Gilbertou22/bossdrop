const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const auth = async (req, res, next) => {
    const token = req.header('x-auth-token');
    //console.log('Received token in auth:', token ? token.substring(0, 20) + '...' : 'No token'); // 調試
    if (!token) {
        return res.status(401).json({ msg: '無權限，缺少 Token' });
    }

    try {
        //console.log('Verifying with JWT_SECRET:', process.env.JWT_SECRET); // 調試
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        //console.log('Decoded token in auth:', decoded); // 調試
        if (!decoded.id) {
            throw new Error('Decoded token missing id');
        }
        req.user = { id: decoded.id };

        const user = await User.findById(decoded.id).select('character_name role');
        if (!user) {
            console.log('User not found for id:', decoded.id);
            return res.status(401).json({ msg: '用戶不存在' });
        }

        req.user = {
            id: user._id,
            character_name: user.character_name,
            role: user.role || 'user',
        };
        //console.log('Set req.user in auth:', req.user); // 調試
        next();
    } catch (err) {
        console.error('Token verification error:', {
            message: err.message,
            name: err.name,
            expiredAt: err.expiredAt,
            token: token.substring(0, 20) + '...',
        });
        res.status(401).json({ msg: 'Token 無效', detail: err.message });
    }
};

const adminOnly = (req, res, next) => {
    //console.log('Checking role in adminOnly:', req.user?.role);
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ msg: '僅管理員可訪問' });
    }
    next();
};

module.exports = { auth, adminOnly };