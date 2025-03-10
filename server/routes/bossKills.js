const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const BossKill = require('../models/BossKill');
const multer = require('multer');
const { auth, adminOnly } = require('../middleware/auth');

const upload = multer({
    storage: multer.diskStorage({
        destination: './uploads/',
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
    limits: { fileSize: 600 * 1024 },
});

// 查詢擊殺記錄
router.get('/', auth, async (req, res) => {
    try {
        const { boss_name, start_time, end_time, status } = req.query;
        let query = {};

        if (boss_name) query.boss_name = boss_name;
        if (start_time || end_time) {
            query.kill_time = {};
            if (start_time) query.kill_time.$gte = new Date(start_time);
            if (end_time) query.kill_time.$lte = new Date(end_time);
        }
        if (status) query.status = status;

        if (req.user.role !== 'admin') {
            query.attendees = req.user.character_name;
        }

        console.log('Querying boss kills with:', query);
        const bossKills = await BossKill.find(query).lean(); // 移除 populate
        console.log('Fetched boss kills:', bossKills.length);
        res.json(bossKills);
    } catch (err) {
        console.error('Error fetching boss kills:', err);
        res.status(500).json({ msg: err.message });
    }
});

// 獲取所有擊殺記錄
router.get('/all', auth, adminOnly, async (req, res) => {
    try {
        console.log('Fetching all boss kills for admin:', req.user?.character_name || 'Unknown');
        const bossKills = await BossKill.find()
            .sort({ kill_time: -1 }); // 移除 populate
        console.log('Fetched all boss kills:', bossKills.length);
        res.json(bossKills);
    } catch (err) {
        console.error('Error fetching all boss kills:', {
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取所有擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 更新擊殺記錄 (管理員)
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { final_recipient, status } = req.body;

    try {
        const bossKill = await BossKill.findById(req.params.id);
        if (!bossKill) {
            return res.status(404).json({ msg: '擊殺記錄不存在' });
        }

        if (final_recipient) bossKill.final_recipient = final_recipient;
        if (status && ['pending', 'assigned'].includes(status)) bossKill.status = status;

        await bossKill.save();
        res.json({ msg: '擊殺記錄更新成功', bossKill });
    } catch (err) {
        res.status(500).json({ msg: err.message || '更新失敗' });
    }
});

router.post('/', auth, adminOnly, upload.array('screenshots', 5), async (req, res) => {
    const { boss_name, kill_time, dropped_items, attendees, final_recipient, status } = req.body;

    try {
        const screenshots = req.files.map(file => file.path);
        const items = JSON.parse(dropped_items).map(item => ({
            _id: new mongoose.Types.ObjectId(),
            name: item.name,
            type: item.type,
            apply_deadline: new Date(new Date(kill_time).getTime() + 7 * 24 * 60 * 60 * 1000),
        }));

        let parsedAttendees = attendees;
        if (typeof attendees === 'string') {
            try {
                parsedAttendees = JSON.parse(attendees);
            } catch (e) {
                return res.status(400).json({ msg: 'attendees 格式錯誤' });
            }
        }
        if (!Array.isArray(parsedAttendees) || !parsedAttendees.every(item => typeof item === 'string')) {
            return res.status(400).json({ msg: 'attendees 必須是字符串陣列' });
        }

        const bossKill = new BossKill({
            boss_name,
            kill_time,
            dropped_items: items,
            attendees: parsedAttendees,
            screenshots,
            final_recipient: final_recipient || null,
            status: status || 'pending',
            userId: req.user.id, // 設置創建者為當前用戶
        });

        await bossKill.save();
        res.json({ kill_id: bossKill._id });
    } catch (err) {
        console.error('Error saving boss kill:', err);
        res.status(500).json({ msg: err.message || '保存失敗' });
    }
});

module.exports = router;