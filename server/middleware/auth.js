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
        console.log('Verifying token:', token.substring(0, 20) + '...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded Token:', decoded);

        const userId = decoded.user ? decoded.user.id : decoded.id;
        if (!userId) {
            throw new Error('Decoded token missing user.id or id');
        }

        req.user = decoded.user ? decoded.user : { id: decoded.id };

        const user = await User.findById(userId).select('character_name role');
        if (!user) {
            console.log('User not found for ID:', userId);
            return res.status(401).json({ msg: '用戶不存在' });
        }

        req.user = {
            id: user._id.toString(), // Ensure req.user.id is a string
            character_name: user.character_name,
            role: user.role || 'user',
        };

        console.log('Authenticated user:', req.user);

        // Ensure req.session exists, avoid throwing TypeError
        if (req.session) {
            console.log('Session data before setting userId:', req.session);
            if (req.session.userId && req.session.userId !== req.user.id.toString()) {
                console.log('Destroying session due to userId mismatch:', {
                    existingUserId: req.session.userId,
                    newUserId: req.user.id,
                });
                req.session.destroy(err => {
                    if (err) console.error('Session destroy error:', err);
                });
            } else {
                req.session.userId = req.user.id; // Store as string
                console.log('Set req.session.userId:', req.session.userId);
            }
        } else {
            console.warn('Session middleware not initialized, req.session is undefined');
        }

        next();
    } catch (err) {
        console.error('Token verification error:', {
            message: err.message,
            name: err.name,
            expiredAt: err.expiredAt,
            token: token ? token.substring(0, 20) + '...' : 'No token',
        });

        if (err.name === 'TokenExpiredError' && req.session) {
            req.session.destroy(err => {
                if (err) console.error('Session destroy error:', err);
            });
        }

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