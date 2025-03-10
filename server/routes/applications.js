const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const BossKill = require('../models/BossKill');
const { auth, adminOnly } = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
    const { kill_id, item_id, item_name } = req.body;
    const user = req.user;

    try {
        console.log('Received request body:', req.body);
        console.log('User from token:', user);

        if (!user || !user.character_name) {
            return res.status(401).json({
                code: 401,
                msg: '無法識別用戶身份',
                detail: '請確保已正確登錄並提供有效的 Token。',
                suggestion: '請重新登錄或聯繫管理員。',
            });
        }

        if (!kill_id || !item_id || !item_name) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `Missing required fields: ${!kill_id ? 'kill_id' : ''} ${!item_id ? 'item_id' : ''} ${!item_name ? 'item_name' : ''}`,
                suggestion: '請提供所有必填字段後重試。',
            });
        }

        const kill = await BossKill.findById(kill_id);
        if (!kill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${kill_id} 的擊殺記錄。`,
                suggestion: '請檢查擊殺記錄 ID 或聯繫管理員。',
            });
        }

        if (kill.status === 'assigned' && kill.final_recipient) {
            return res.status(403).json({
                code: 403,
                msg: '該物品已分配，無法申請',
                detail: `擊殺記錄 ${kill_id} 的物品已分配給 ${kill.final_recipient}。`,
                suggestion: '請選擇其他未分配的物品或聯繫管理員。',
            });
        }

        const existingApplication = await Application.findOne({
            user_id: user.id,
            kill_id,
            item_id,
        });
        if (existingApplication) {
            return res.status(403).json({
                code: 403,
                msg: '你已針對此擊殺和物品提交過申請',
                detail: `您針對 ${kill.boss_name} 的 ${item_name} 已提交申請 (ID: ${existingApplication._id})。`,
                suggestion: '請檢查現有申請或聯繫管理員。',
            });
        }

        let attendees = kill.attendees || [];
        if (!Array.isArray(attendees)) {
            attendees = attendees.split(',').map(a => a.trim());
        }
        console.log('Attendees from kill:', attendees);

        const isAttendee = attendees.some(attendee => attendee === user.character_name);
        if (!isAttendee) {
            return res.status(403).json({
                code: 403,
                msg: '你未出席此擊殺，無法申請',
                detail: `您的角色 ${user.character_name} 未在 ${kill.boss_name} 的出席名單中。`,
                suggestion: '請確認參加資格或聯繫管理員。',
            });
        }

        // 調試 dropped_items
        console.log('Kill dropped items:', kill.dropped_items);
        const droppedItem = kill.dropped_items.find(item => item._id && item._id.toString() === item_id && item.name === item_name);
        if (!droppedItem) {
            return res.status(400).json({
                code: 400,
                msg: '該物品未在此次擊殺中掉落或 item_id 無效',
                detail: `${item_name} 的 item_id (${item_id}) 不在 ${kill.boss_name} 的掉落列表中。`,
                suggestion: '請選擇正確的掉落物品或檢查數據。',
            });
        }

        const application = new Application({
            user_id: user.id,
            kill_id,
            item_id: droppedItem._id,
            item_name,
            status: 'pending',
        });
        await application.save();

        res.status(201).json({
            code: 201,
            msg: '申請提交成功，等待審核',
            detail: `申請 ID: ${application._id} 已創建。`,
            application_id: application._id,
        });
    } catch (err) {
        console.error('Application error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                code: 400,
                msg: '驗證失敗',
                detail: err.message,
                suggestion: '請檢查請求數據並重試。',
            });
        }
        res.status(500).json({
            code: 500,
            msg: '申請失敗，請稍後再試',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.put('/:id/approve', auth, adminOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({
                code: 404,
                msg: '申請不存在',
                detail: `無法找到 ID 為 ${id} 的申請。`,
                suggestion: '請檢查申請 ID 或聯繫管理員。',
            });
        }
        application.status = 'approved';
        await application.save();
        res.json({
            code: 200,
            msg: '申請已審批',
            detail: `申請 ID: ${id} 已審批。`,
        });
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '審批申請失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const applications = await Application.find()
            .populate('user_id', 'character_name')
            .populate('kill_id', 'boss_name kill_time');
        res.json(applications);
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '獲取申請列表失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.get('/user', auth, async (req, res) => {
    try {
        const applications = await Application.find({ user_id: req.user.id }).select('user_id item_id item_name');
        console.log('Fetched applications for user:', applications);
        const formattedApplications = applications.map(app => `${app.user_id}_${app.item_id}`);
        res.json(formattedApplications);
    } catch (err) {
        res.status(500).json({ msg: '獲取申請記錄失敗', error: err.message });
    }
});

module.exports = router;