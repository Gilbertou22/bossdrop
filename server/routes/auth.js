const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Guild = require('../models/Guild');
const MenuItem = require('../models/MenuItem'); // 引入 MenuItem 模型
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../logger');
require('dotenv').config();

// 獲取客戶端 IP 地址
router.get('/client-ip', (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.ip || '未知 IP';
        res.status(200).json({ ip: clientIp });
    } catch (err) {
        res.status(500).json({ msg: '無法獲取 IP 地址', detail: err.message });
    }
});

router.post('/register', async (req, res) => {
    const { world_name, character_name, password, guildPassword } = req.body;
    console.log('Register request body:', req.body);

    try {
        if (!world_name || !character_name || !password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 world_name、character_name、password',
            });
        }

        let user = await User.findOne({ character_name });
        if (user) {
            return res.status(400).json({
                code: 400,
                msg: '用戶名已存在',
                detail: '請選擇其他用戶名',
            });
        }

        const guild = await Guild.findOne({ password: guildPassword });
        if (!guild) {
            return res.status(400).json({
                code: 400,
                msg: '無效的團隊密碼',
                detail: '請確認輸入的團隊密碼是否正確',
            });
        }

        user = new User({
            world_name,
            character_name,
            password, // 密碼將由 pre-save 中間件哈希
            role: 'user',
            diamonds: 0,
            guildId: guild._id,
            mustChangePassword: false,
        });

        console.log('User before save:', user);
        await user.save();

        const payload = {
            user: {
                id: user._id,
                role: user.role,
            },
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
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
        if (!character_name || !password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 character_name 和 password',
            });
        }

        const user = await User.findOne({ character_name });
        if (!user) {
            return res.status(400).json({
                code: 400,
                msg: '用戶不存在',
                detail: '請檢查用戶名或註冊新賬號',
            });
        }

        console.log('User found:', user.password, password);
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch);
        if (!isMatch) {
            return res.status(400).json({
                code: 400,
                msg: '密碼錯誤',
                detail: '請檢查密碼是否正確',
            });
        }

        // 生成菜單數據並存入 session
        const menuItems = await MenuItem.find()
            .populate({
                path: 'children',
                populate: { path: 'children' },
            })
            .sort({ order: 1 });

        console.log('Raw menu items:', menuItems); // 檢查原始數據

        // 過濾菜單項，僅保留當前用戶角色有權訪問的節點
        const filterMenuItems = (items, userRole) => {
            return items
                .filter(item => {
                    let roles;
                    try {
                        roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
                        while (typeof roles === 'string') {
                            roles = JSON.parse(roles);
                        }
                    } catch (err) {
                        logger.warn('Failed to parse roles', { roles: item.roles, error: err.message });
                        roles = [];
                    }
                    console.log('Filtering item:', item.label, 'Roles:', roles, 'User role:', userRole);
                    return roles.includes(userRole);
                })
                .map(item => {
                    const filteredItem = {
                        key: item.key,
                        label: item.label,
                        icon: item.icon,
                        customIcon: item.customIcon,
                        roles: item.roles,
                        parentId: item.parentId,
                        order: item.order,
                        _id: item._id.toString(),
                    };
                    if (item.children && item.children.length > 0) {
                        filteredItem.children = filterMenuItems(item.children, userRole);
                    }
                    return filteredItem;
                })
                .filter(item => item.children ? item.children.length > 0 : true);
        };

        const filteredMenuItems = filterMenuItems(menuItems, user.role);
        console.log('Filtered menu items:', filteredMenuItems); // 檢查過濾後數據
        req.session.menuItems = filteredMenuItems; // 將過濾後的菜單數據存入 session
        logger.info('Menu items stored in session', { userId: user._id, menuItems: filteredMenuItems });

        const payload = {
            user: {
                id: user._id,
                role: user.role || 'user',
            },
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            code: 200,
            msg: '登入成功',
            token,
            user: {
                id: user._id,
                character_name: user.character_name,
                role: user.role,
                mustChangePassword: user.mustChangePassword,
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