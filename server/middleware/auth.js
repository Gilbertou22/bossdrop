const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const auth = async (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        console.log('Received token in auth: No token');
        return res.status(401).json({ msg: '無權限，缺少 Token' });
    }

    try {
        //console.log('Token:', token);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        //console.log('Decoded Token:', decoded);

        // 檢查嵌套的 id 字段
        const userId = decoded.user ? decoded.user.id : decoded.id;
        if (!userId) {
            throw new Error('Decoded token missing user.id or id');
        }

        // 設置 req.user
        req.user = decoded.user ? decoded.user : { id: decoded.id };

        const user = await User.findById(userId).select('character_name role');
        if (!user) {
            return res.status(401).json({ msg: '用戶不存在' });
        }

        req.user = {
            id: user._id,
            character_name: user.character_name,
            role: user.role || 'user',
        };

        next();
    } catch (err) {
        console.error('Token verification error:', {
            message: err.message,
            name: err.name,
            expiredAt: err.expiredAt,
            token: token ? token.substring(0, 20) + '...' : 'No token',
        });
        res.status(401).json({ msg: 'Token 無效或已過期', detail: err.message });
    }
};

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ msg: '僅管理員可訪問' });
    }
    next();
};

module.exports = { auth, adminOnly };