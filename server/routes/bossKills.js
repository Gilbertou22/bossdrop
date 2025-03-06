const express = require('express');
const mongoose = require('mongoose'); // 添加 mongoose 導入
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

router.get('/', auth, async (req, res) => {
    console.log('Fetching boss kills for user:', req.user?.character_name, 'Role:', req.user?.role);
    try {
        const { boss_name, start_time, end_time } = req.query;
        let query = {};
        if (boss_name) query.boss_name = boss_name;
        if (start_time || end_time) {
            query.kill_time = {};
            if (start_time) query.kill_time.$gte = new Date(start_time);
            if (end_time) query.kill_time.$lte = new Date(end_time);
        }
        // 權限檢查
        if (req.user.role !== 'admin') {
            query.attendees = req.user.character_name; // 非管理員僅顯示自己出席的記錄
        }
        const bossKills = await BossKill.find(query).lean();
        console.log('Fetched boss kills count:', bossKills.length, 'Data:', JSON.stringify(bossKills, null, 2));
        res.json(bossKills);
    } catch (err) {
        res.status(500).json({ msg: '獲取擊殺記錄失敗', error: err.message });
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

// 記錄擊殺 (管理員)
router.post('/', auth, adminOnly, upload.array('screenshots', 5), async (req, res) => {
    const { boss_name, kill_time, dropped_items, attendees, final_recipient, status } = req.body;

    try {
        const screenshots = req.files.map(file => file.path);
        const items = JSON.parse(dropped_items).map(item => ({
            _id: new mongoose.Types.ObjectId(), // 為每個 dropped_item 分配新的 _id
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
        });

        await bossKill.save();
        res.json({ kill_id: bossKill._id });
    } catch (err) {
        console.error('Error saving boss kill:', err);
        res.status(500).json({ msg: err.message || '保存失敗' });
    }
});

module.exports = router;