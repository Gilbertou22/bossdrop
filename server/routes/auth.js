const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

router.post('/register', async (req, res) => {
    const { character_name, password } = req.body;

    try {
        let user = await User.findOne({ character_name });
        if (user) {
            return res.status(400).json({ msg: '用戶名已存在' });
        }

        user = new User({
            character_name,
            password,
            role: 'user', // 默認角色
            diamonds: 0,
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const payload = {
            user: {
                id: user.id,
                role: user.role,
            },
        };

        jwt.sign(payload, config.get('jwtSecret'), { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ msg: '伺服器錯誤' });
    }
});

router.post('/login', async (req, res) => {
    const { character_name, password } = req.body;

    try {
        // 檢查必填欄位
        if (!character_name || !password) {
            return res.status(400).json({ msg: '請提供角色名稱和密碼' });
        }

        // 查找用戶
        const user = await User.findOne({ character_name });
        if (!user) {
            return res.status(400).json({ msg: '用戶不存在' });
        }

        // 驗證密碼
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: '密碼錯誤' });
        }

        // 生成 JWT Token
        const payload = { id: user._id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: err.message || '登入失敗，請稍後再試' });
    }
});

module.exports = router;