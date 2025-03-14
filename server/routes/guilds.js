const express = require('express');
const router = express.Router();
const Guild = require('../models/Guild');
const { auth, adminOnly } = require('../middleware/auth');
const crypto = require('crypto');

// 生成隨機團隊密碼
const generateGuildPassword = () => {
    return crypto.randomBytes(8).toString('hex');
};

// 預設旅團設定
const defaultGuildSettings = {
    settings: {
        applyDeadlineHours: 48,
        editDeadlineHours: 24,
        deleteDeadlineHours: 24,
        publicFundRate: 0.1,
        creatorExtraShare: false,
        leaderExtraShare: false,
        restrictBilling: false,
        withdrawMinAmount: 100,
    },
};

router.get('/me', auth, async (req, res) => {
    try {
        const guild = await Guild.findOne({ createdBy: req.user.id }).lean();
        if (!guild) {
            return res.json(defaultGuildSettings);
        }
        res.json(guild);
    } catch (err) {
        res.status(500).json({ msg: '獲取旅團資訊失敗', error: err.message });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const guilds = await Guild.find().select('name _id').lean();
        res.json(guilds);
    } catch (err) {
        res.status(500).json({ msg: '獲取旅團列表失敗', error: err.message });
    }
});

// 創建團隊
router.post('/', auth, adminOnly, async (req, res) => {
    const { name } = req.body;
    try {
        const existingGuild = await Guild.findOne({ name });
        if (existingGuild) {
            return res.status(400).json({ msg: '團隊名稱已存在' });
        }
        const guild = new Guild({
            name,
            password: generateGuildPassword(),
            createdBy: req.user.id,
        });
        await guild.save();
        res.status(201).json(guild);
    } catch (err) {
        res.status(500).json({ msg: '創建團隊失敗', error: err.message });
    }
});

// 獲取團隊設定
router.get('/:id', auth, async (req, res) => {
    try {
        const guild = await Guild.findById(req.params.id);
        if (!guild) {
            return res.status(404).json({ msg: '團隊不存在' });
        }
        if (guild.createdBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ msg: '無權限訪問' });
        }
        res.json(guild);
    } catch (err) {
        res.status(500).json({ msg: '獲取團隊設定失敗', error: err.message });
    }
});

// 更新團隊設定
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { password, announcement, settings } = req.body;
    try {
        const guild = await Guild.findById(req.params.id);
        if (!guild) {
            return res.status(404).json({ msg: '團隊不存在' });
        }
        if (guild.createdBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ msg: '無權限修改' });
        }
        if (password) guild.password = password;
        if (announcement !== undefined) guild.announcement = announcement;
        if (settings) {
            guild.settings = { ...guild.settings, ...settings };
        }
        guild.updatedAt = Date.now();
        await guild.save();
        res.json({ msg: '團隊設定更新成功', guild });
    } catch (err) {
        res.status(500).json({ msg: '更新團隊設定失敗', error: err.message });
    }
});

module.exports = router;