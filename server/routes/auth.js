const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

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