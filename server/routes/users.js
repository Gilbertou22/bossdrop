const express = require('express');
const router = express.Router();
const User = require('../models/User');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
const { auth, adminOnly } = require('../middleware/auth'); // 移除 adminOnly

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 600 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('僅支援 JPEG/PNG 圖片！'));
    },
});

// 全局路由日志
router.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.path} - User:`, req.user);
    next();
});

// 註冊用戶
router.post('/register', upload.single('screenshot'), async (req, res) => {
    const { world_name, character_name, discord_id, raid_level, password } = req.body;

    try {
        let user = await User.findOne({ character_name });
        if (user) {
            return res.status(400).json({ msg: '用戶名已存在' });
        }

        const screenshot = req.file ? req.file.path : null;

        user = new User({
            world_name,
            character_name,
            discord_id: discord_id || null,
            raid_level: raid_level ? parseInt(raid_level) : 0,
            password,
            screenshot,
            status: 'pending',
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const payload = {
            user: {
                id: user.id,
                role: user.role || 'user',
            },
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: 3600 });
        res.json({ user_id: user._id, token, msg: '註冊成功，等待審核！' });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ msg: '伺服器錯誤: ' + err.message });
    }
});

// 獲取所有用戶 (僅管理員)
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select('world_name character_name discord_id raid_level diamonds status screenshot role');
        res.json(users);
    } catch (err) {
        res.status(500).json({ msg: '獲取用戶列表失敗', error: err.message });
    }
});

// 獲取當前用戶信息
router.get('/profile', auth, async (req, res) => {
    console.log('GET /profile - req.user:', req.user);
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id).select('character_name world_name discord_id raid_level diamonds status screenshot role');
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試' });
    }
});

// 更新用戶 (僅管理員)
router.put('/users/:id', auth, adminOnly, upload.single('screenshot'), async (req, res) => {
    console.log('PUT /users/:id request - req.user:', req.user, 'params.id:', req.params.id);
    const { world_name, character_name, discord_id, raid_level, diamonds, status, role, password } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: '用戶不存在' });
        if (character_name && character_name !== user.character_name) {
            const existingUser = await User.findOne({ character_name });
            if (existingUser) return res.status(400).json({ msg: '角色名稱已存在' });
        }
        user.world_name = world_name || user.world_name;
        user.character_name = character_name || user.character_name;
        user.discord_id = discord_id || user.discord_id;
        user.raid_level = raid_level !== undefined ? parseInt(raid_level) : user.raid_level;
        user.diamonds = diamonds !== undefined ? parseInt(diamonds) : user.diamonds;
        user.status = status || user.status;
        user.screenshot = req.file ? req.file.path : user.screenshot;
        user.role = role || user.role;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        await user.save();
        res.json({ msg: '用戶更新成功', user });
    } catch (err) {
        res.status(500).json({ msg: '更新用戶失敗', error: err.message });
    }
});

// 刪除用戶 (僅管理員)
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: '用戶不存在' });
        await user.remove();
        res.json({ msg: '用戶刪除成功' });
    } catch (err) {
        res.status(500).json({ msg: '刪除用戶失敗', error: err.message });
    }
});

// 更新自身資料
router.put('/profile', auth, async (req, res) => {
    console.log('PUT /profile request - req.user:', req.user); // 調試
    const { world_name, discord_id, raid_level } = req.body;
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        console.log('Finding user with id:', req.user.id); // 調試
        const user = await User.findById(req.user.id); // 確保使用 req.user.id
        if (!user) return res.status(404).json({ msg: '用戶未找到' });

        user.world_name = world_name || user.world_name;
        user.discord_id = discord_id || user.discord_id;
        user.raid_level = raid_level !== undefined ? parseInt(raid_level) : user.raid_level;

        await user.save();
        res.json({ msg: '用戶資料更新成功' });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ msg: '更新失敗', error: err.message });
    }
});

// 獲取當前用戶信息
router.get('/me', auth, async (req, res) => {
    console.log('GET /me - req.user:', req.user);
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id).select('character_name world_name discord_id raid_level diamonds status screenshot role _id');
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        res.json({
            id: user._id.toString(), // 確保返回字符串格式的 _id
            character_name: user.character_name,
            role: user.role,
            world_name: user.world_name,
            discord_id: user.discord_id,
            raid_level: user.raid_level,
            diamonds: user.diamonds,
            status: user.status,
            screenshot: user.screenshot ? `${req.protocol}://${req.get('host')}/${user.screenshot.replace('./', '')}` : null,
        });
        console.log('Response sent:', { id: user._id.toString(), character_name: user.character_name, role: user.role }); // 調試
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試', error: err.message });
    }
});

module.exports = router;