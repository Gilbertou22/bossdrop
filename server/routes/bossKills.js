const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Application = require('../models/Application'); // 假設存在 Application 模型
const Auction = require('../models/Auction'); // 假設存在 Auction 模型
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
    try {
        const { boss_name, start_time, end_time, status } = req.query;
        let query = {};

        if (boss_name) query.boss_name = { $regex: boss_name, $options: 'i' };
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
        const bossKills = await BossKill.find(query).lean();

        // 檢查 apply_deadline 和申請記錄
        const currentDate = new Date();
        const enrichedKills = await Promise.all(bossKills.map(async kill => {
            const updatedItems = await Promise.all(kill.dropped_items.map(async item => {
                let itemStatus = item.status || 'pending';
                // 檢查 apply_deadline
                if (item.apply_deadline && new Date(item.apply_deadline) < currentDate && itemStatus !== 'assigned') {
                    itemStatus = 'expired';
                }
                // 檢查是否有已批准的申請
                const approvedApplication = await Application.findOne({
                    kill_id: kill._id,
                    item_id: item._id,
                    status: 'approved',
                }).lean();
                if (approvedApplication && itemStatus !== 'expired') {
                    itemStatus = 'assigned';
                }
                return {
                    ...item,
                    status: itemStatus,
                    final_recipient: approvedApplication ? approvedApplication.user_id.character_name : item.final_recipient,
                };
            }));
            return {
                ...kill,
                dropped_items: updatedItems,
            };
        }));

        console.log('Fetched boss kills:', enrichedKills.length);
        res.json(enrichedKills);
    } catch (err) {
        console.error('Error fetching boss kills:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取所有擊殺記錄（分頁）
router.get('/all', auth, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        console.log('Fetching all boss kills for admin:', req.user?.character_name || 'Unknown');
        const bossKills = await BossKill.find()
            .sort({ kill_time: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await BossKill.countDocuments();

        // 為每個 dropped_item 添加分配狀態
        const enrichedKills = await Promise.all(bossKills.map(async (kill) => {
            const enrichedItems = await Promise.all(kill.dropped_items.map(async (item) => {
                const auction = await Auction.findOne({ itemId: item._id }).lean();
                const application = await Application.findOne({ item_id: item._id, status: 'approved' }).lean();

                const isAssigned = auction || application || item.status === 'assigned' || item.final_recipient;
                return {
                    ...item,
                    status: isAssigned ? 'assigned' : (item.status || 'pending'),
                    final_recipient: auction?.highestBidder?.character_name ||
                        application?.user_id?.character_name ||
                        item.final_recipient ||
                        null,
                    isAssigned: !!isAssigned,
                };
            }));
            return {
                ...kill,
                dropped_items: enrichedItems,
            };
        }));

        console.log('Fetched all boss kills:', enrichedKills.length);
        res.json({
            data: enrichedKills,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
        });
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
    const { final_recipient, status, dropped_items } = req.body;

    try {
        const bossKill = await BossKill.findById(req.params.id);
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                suggestion: '請檢查 ID 或聯繫管理員',
            });
        }

        if (final_recipient) bossKill.final_recipient = final_recipient;
        if (status && ['pending', 'assigned', 'expired'].includes(status)) bossKill.status = status;
        if (dropped_items) {
            bossKill.dropped_items = dropped_items.map(item => ({
                ...item,
                _id: item._id || new mongoose.Types.ObjectId(),
                status: item.status || 'pending',
                final_recipient: item.final_recipient || null,
            }));
        }

        await bossKill.save();
        res.json({ msg: '擊殺記錄更新成功', bossKill });
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '更新擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.post('/', auth, adminOnly, upload.array('screenshots', 5), async (req, res) => {
    const { boss_name, kill_time, dropped_items, attendees, final_recipient, status, apply_deadline_days } = req.body;

    try {
        const screenshots = req.files.map(file => file.path);
        const items = JSON.parse(dropped_items).map(item => ({
            _id: new mongoose.Types.ObjectId(),
            name: item.name,
            type: item.type,
            apply_deadline: new Date(new Date(kill_time).getTime() + (apply_deadline_days || 7) * 24 * 60 * 60 * 1000),
            status: 'pending',
            final_recipient: null,
        }));

        let parsedAttendees = attendees;
        if (typeof attendees === 'string') {
            try {
                parsedAttendees = JSON.parse(attendees);
            } catch (e) {
                return res.status(400).json({
                    code: 400,
                    msg: 'attendees 格式錯誤',
                    detail: 'attendees 必須是有效的 JSON 字符串陣列',
                    suggestion: '請檢查輸入格式，例如 ["user1", "user2"]',
                });
            }
        }
        if (!Array.isArray(parsedAttendees) || !parsedAttendees.every(item => typeof item === 'string')) {
            return res.status(400).json({
                code: 400,
                msg: 'attendees 必須是字符串陣列',
                detail: '例如 ["user1", "user2"]',
                suggestion: '請檢查輸入格式',
            });
        }

        // 為每個物品創建獨立記錄
        const results = [];
        for (const item of items) {
            const bossKill = new BossKill({
                boss_name,
                kill_time,
                dropped_items: [item],
                attendees: parsedAttendees,
                screenshots,
                final_recipient: final_recipient || null,
                status: status || 'pending',
                userId: req.user.id,
            });
            await bossKill.save();
            results.push({ kill_id: bossKill._id });
        }

        res.status(201).json({ msg: '擊殺記錄創建成功', results });
    } catch (err) {
        console.error('Error saving boss kills:', err);
        res.status(500).json({
            code: 500,
            msg: '保存擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;