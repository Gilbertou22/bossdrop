const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Guild = require('../models/Guild');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
const jsonwebtoken = require('jsonwebtoken');
const { auth, adminOnly } = require('../middleware/auth');

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

router.use((req, res, next) => {
    //console.log(`Incoming request: ${req.method} ${req.path} - User:`, req.user);
    next();
});

router.get('/stats', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ code: 401, msg: '未授權，缺少用戶信息' });
        }
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ status: 'active' });
        res.json({ totalUsers, activeUsers });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        res.status(500).json({ code: 500, msg: '獲取用戶統計失敗' });
    }
});

router.post('/register', upload.single('screenshot'), async (req, res) => {
    const { world_name, character_name, discord_id, raid_level, password, guildId } = req.body;
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
            guildId: guildId || null,
            mustChangePassword: false, // 自行註冊的用戶不需要強制更改密碼
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

        const token = jsonwebtoken.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: 3600 });
        res.json({ user_id: user._id, token, msg: '註冊成功，等待審核！' });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ msg: '伺服器錯誤: ' + err.message });
    }
});

router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select('world_name character_name discord_id raid_level diamonds status screenshot role guildId mustChangePassword createdAt updatedAt');
        res.json(users);
    } catch (err) {
        res.status(500).json({ msg: '獲取用戶列表失敗', error: err.message });
    }
});

router.get('/profile', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id).select('character_name world_name discord_id raid_level diamonds status screenshot role guildId mustChangePassword');
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試' });
    }
});

router.delete('/api/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: '用戶不存在', detail: `ID ${req.params.id} 未找到` });
        await user.remove();
        res.json({ msg: '用戶刪除成功' });
    } catch (err) {
        res.status(500).json({ msg: '刪除用戶失敗', error: err.message });
    }
});

router.put('/:id', auth, adminOnly, upload.single('screenshot'), async (req, res) => {
    //console.log('PUT /api/users/:id request - req.user:', req.user, 'params.id:', req.params.id);
    const { world_name, character_name, discord_id, raid_level, diamonds, status, role, password, guildId, mustChangePassword } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            console.log(`User not found for ID: ${req.params.id}`);
            return res.status(404).json({ msg: '用戶不存在', detail: `ID ${req.params.id} 未找到` });
        }
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
        user.guildId = guildId || user.guildId;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        user.mustChangePassword = mustChangePassword !== undefined ? mustChangePassword : user.mustChangePassword; // 更新是否需更改密碼
        await user.save();
        //console.log(`User updated successfully: ${user._id}`);
        res.json({ msg: '用戶更新成功', user });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ msg: '更新用戶失敗', error: err.message });
    }
});

router.put('/profile', auth, async (req, res) => {
    const { world_name, discord_id, raid_level, guildId } = req.body;
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: '用戶未找到' });

        user.world_name = world_name || user.world_name;
        user.discord_id = discord_id || user.discord_id;
        user.raid_level = raid_level !== undefined ? parseInt(raid_level) : user.raid_level;
        user.guildId = guildId || user.guildId;

        await user.save();
        res.json({ msg: '用戶資料更新成功' });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ msg: '更新失敗', error: err.message });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id).select('character_name world_name discord_id raid_level diamonds status screenshot role _id guildId mustChangePassword');
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        res.json({
            id: user._id.toString(),
            character_name: user.character_name,
            role: user.role,
            world_name: user.world_name,
            discord_id: user.discord_id,
            raid_level: user.raid_level,
            diamonds: user.diamonds,
            status: user.status,
            screenshot: user.screenshot ? `${req.protocol}://${req.get('host')}/${user.screenshot.replace('./', '')}` : null,
            guildId: user.guildId,
            mustChangePassword: user.mustChangePassword, // 返回是否需要更改密碼
        });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試', error: err.message });
    }
});

router.get('/growth', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const { range = 30 } = req.query;
        const now = new Date();
        const startDate = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
        const growthData = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: now },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        res.json(growthData);
    } catch (err) {
        console.error('Error fetching user growth:', err);
        res.status(500).json({ code: 500, msg: '獲取用戶增長數據失敗' });
    }
});

// 新增：管理員創建成員
router.post('/create-member', auth, adminOnly, upload.none(), async (req, res) => {
    const { character_name, password, guildId, useGuildPassword, world_name } = req.body;

    try {
        //console.log('Received create-member request:', req.body); // 調試日誌

        if (!character_name || !guildId) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `請提供 character_name 和 guildId，當前值: character_name=${character_name}, guildId=${guildId}`,
            });
        }

        if (!world_name) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 world_name',
            });
        }

        const guild = await Guild.findById(guildId);
        if (!guild) {
            return res.status(400).json({
                code: 400,
                msg: '團隊不存在',
                detail: `無法找到 ID 為 ${guildId} 的團隊`,
            });
        }

        const existingUser = await User.findOne({ character_name });
        if (existingUser) {
            return res.status(400).json({
                code: 400,
                msg: '用戶名已存在',
                detail: '請選擇其他用戶名',
            });
        }

        let finalPassword = password;
        // 處理 useGuildPassword 可能為數組的情況
        const useGuildPasswordValue = Array.isArray(useGuildPassword) ? useGuildPassword[0] : useGuildPassword;
        if (useGuildPasswordValue === 'true') {
            if (!guild.password) {
                return res.status(400).json({
                    code: 400,
                    msg: '旅團密碼不可用',
                    detail: '選中的旅團未設置密碼',
                });
            }
            finalPassword = guild.password;
        } else if (!password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少密碼',
                detail: '請提供密碼或選擇使用旅團密碼',
            });
        }

        console.log('Final password:', finalPassword); // 調試日誌

        const user = new User({
            world_name, // 添加 world_name
            character_name,
            password: finalPassword,
            role: 'user',
            guildId,
            mustChangePassword: true, // 管理員創建的成員需更改密碼
            status: 'pending', // 預設待審核
        });

        console.log('New user object:', user); // 調試日誌

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(finalPassword, salt);

        await user.save();

        res.status(201).json({
            code: 201,
            msg: '成員創建成功',
            user: {
                character_name: user.character_name,
                guildId: user.guildId,
                mustChangePassword: user.mustChangePassword,
            },
        });
    } catch (err) {
        console.error('Create member error:', err);
        res.status(500).json({
            code: 500,
            msg: '創建成員失敗',
            detail: err.message,
        });
    }
});

// 新增：更改密碼
router.post('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供當前密碼和新密碼',
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                code: 404,
                msg: '用戶不存在',
                detail: '請檢查用戶是否有效',
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                code: 400,
                msg: '當前密碼錯誤',
                detail: '請檢查輸入的當前密碼',
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.mustChangePassword = false; // 更改密碼後設置為 false
        await user.save();

        res.json({
            code: 200,
            msg: '密碼更改成功',
            detail: '您已成功更改密碼，請使用新密碼登入',
        });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({
            code: 500,
            msg: '更改密碼失敗',
            detail: err.message,
        });
    }
});

module.exports = router;