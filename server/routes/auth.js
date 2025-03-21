const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Guild = require('../models/Guild');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

router.post('/register', async (req, res) => {
    const { world_name, character_name, password } = req.body;

    try {
        // 檢查必填字段
        if (!world_name || !character_name || !password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 world_name、character_name、password ',
            });
        }

        // 檢查用戶名是否已存在
        let user = await User.findOne({ character_name });
        if (user) {
            return res.status(400).json({
                code: 400,
                msg: '用戶名已存在',
                detail: '請選擇其他用戶名',
            });
        }

        // 驗證團隊密碼並獲取 guildId
        const guild = await Guild.findOne({ password: guildPassword });
        if (!guild) {
            return res.status(400).json({
                code: 400,
                msg: '無效的團隊密碼',
                detail: '請確認輸入的團隊密碼是否正確',
            });
        }

        // 創建新用戶
        user = new User({
            world_name,
            character_name,
            password,
            role: 'user', // 默認角色
            diamonds: 0,
            guildId: guild._id, // 設置 guildId
            mustChangePassword: false, // 自行註冊的用戶不需要強制更改密碼
        });

        // 加密密碼
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        // 生成 JWT Token
        const payload = {
            user: {
                id: user.id,
                role: user.role,
            },
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user._id,
                    character_name: user.character_name,
                    role: user.role,
                    mustChangePassword: user.mustChangePassword,
                },
                msg: '註冊成功！',
            });
        });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '伺服器錯誤',
            detail: err.message,
        });
    }
});

router.post('/login', async (req, res) => {
    const { character_name, password } = req.body;

    try {
        // 檢查必填字段
        if (!character_name || !password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 character_name 和 password',
            });
        }

        // 查找用戶
        const user = await User.findOne({ character_name });
        if (!user) {
            return res.status(400).json({
                code: 400,
                msg: '用戶不存在',
                detail: '請檢查用戶名或註冊新賬號',
            });
        }

        // 驗證密碼
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                code: 400,
                msg: '密碼錯誤',
                detail: '請檢查密碼是否正確',
            });
        }

        // 生成 JWT Token
        const payload = { id: user._id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });

        res.json({
            code: 200,
            msg: '登入成功',
            token,
            user: {
                id: user._id,
                character_name: user.character_name,
                role: user.role,
                mustChangePassword: user.mustChangePassword, // 返回是否需要更改密碼
            },
        });
    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({
            code: 500,
            msg: '登入失敗，請稍後再試',
            detail: err.message,
        });
    }
});

module.exports = router;