const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Guild = require('../models/Guild');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const jsonwebtoken = require('jsonwebtoken');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger'); // 假設你有一個 logger 工具

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
    logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
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
        logger.error('Error fetching user stats:', err.message);
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
            mustChangePassword: false,
        });

        await user.save();

        res.json({ user_id: user._id, msg: '註冊成功，等待審核！' });
    } catch (err) {
        logger.error('Register error:', err.message);
        res.status(500).json({ msg: '伺服器錯誤: ' + err.message });
    }
});

router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select('world_name character_name discord_id raid_level diamonds status screenshot role guildId mustChangePassword createdAt updatedAt');
        res.json(users);
    } catch (err) {
        logger.error('Error fetching users:', err.message);
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
        logger.error('Error fetching user:', err.message);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試' });
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
        logger.error('Update error:', err.message);
        res.status(500).json({ msg: '更新失敗', error: err.message });
    }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
    logger.info(`DELETE /api/users/:id called with id: ${req.params.id}, user: ${req.user?.id}`);
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            logger.warn(`User not found for ID: ${req.params.id}`);
            return res.status(404).json({ msg: '用戶不存在', detail: `ID ${req.params.id} 未找到` });
        }
        if (user.role === 'admin' || user.role === 'guild') {
            return res.status(403).json({ msg: `無法刪除角色為 ${user.role} 的帳號` });
        }
        await user.deleteOne();
        logger.info(`User deleted successfully: ${req.params.id}`);
        res.json({ msg: '用戶刪除成功' });
    } catch (err) {
        logger.error('Delete user error:', err.message);
        res.status(500).json({ msg: '刪除用戶失敗', error: err.message });
    }
});

router.delete('/api/users/batch-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    logger.info(`DELETE /api/users/batch-delete called with ids: ${ids}, user: ${req.user?.id}`);
    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: '請提供有效的用戶 ID 列表' });
        }
        const users = await User.find({ _id: { $in: ids } });
        const protectedUsers = users.filter(user => user.role === 'admin' || user.role === 'guild');
        if (protectedUsers.length > 0) {
            const protectedRoles = [...new Set(protectedUsers.map(user => user.role))].join(', ');
            return res.status(403).json({ msg: `無法刪除角色為 ${protectedRoles} 的帳號` });
        }
        await User.deleteMany({ _id: { $in: ids } });
        logger.info(`Users batch deleted successfully: ${ids}`);
        res.json({ msg: '批量刪除成功' });
    } catch (err) {
        logger.error('Batch delete error:', err.message);
        res.status(500).json({ msg: '批量刪除失敗', error: err.message });
    }
});

router.put('/:id', auth, adminOnly, upload.single('screenshot'), async (req, res) => {
    const { world_name, character_name, discord_id, raid_level, diamonds, status, role, password, guildId, mustChangePassword } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            logger.warn(`User not found for ID: ${req.params.id}`);
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
        user.mustChangePassword = mustChangePassword !== undefined ? mustChangePassword : user.mustChangePassword;
        await user.save();
        logger.info(`User updated successfully: ${req.params.id}`);
        res.json({ msg: '用戶更新成功', user });
    } catch (err) {
        logger.error('Update user error:', err.message);
        res.status(500).json({ msg: '更新用戶失敗', error: err.message });
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
            mustChangePassword: user.mustChangePassword,
        });
    } catch (err) {
        logger.error('Error fetching user:', err.message);
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
        logger.error('Error fetching user growth:', err.message);
        res.status(500).json({ code: 500, msg: '獲取用戶增長數據失敗' });
    }
});

router.post('/create-member', auth, adminOnly, upload.none(), async (req, res) => {
    const { character_name, password, guildId, useGuildPassword, world_name } = req.body;

    try {
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

        logger.info('Final password:', finalPassword);

        const user = new User({
            world_name,
            character_name,
            password: finalPassword,
            role: 'user',
            guildId,
            mustChangePassword: true,
            status: 'pending',
        });

        logger.info('New user object:', user);

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
        logger.error('Create member error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '創建成員失敗',
            detail: err.message,
        });
    }
});

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
        user.mustChangePassword = false;
        await user.save();

        res.json({
            code: 200,
            msg: '密碼更改成功',
            detail: '您已成功更改密碼，請使用新密碼登入',
        });
    } catch (err) {
        logger.error('Change password error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '更改密碼失敗',
            detail: err.message,
        });
    }
});

module.exports = router;