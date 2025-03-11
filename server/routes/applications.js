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

        const droppedItem = kill.dropped_items.find(item => item._id.toString() === item_id);
        if (!droppedItem) {
            return res.status(400).json({
                code: 400,
                msg: '該物品未在此次擊殺中掉落或 item_id 無效',
                detail: `${item_name} 的 item_id (${item_id}) 不在 ${kill.boss_name} 的掉落列表中。`,
                suggestion: '請選擇正確的掉落物品或檢查數據。',
            });
        }

        // 檢查物品是否已被分配
        const existingApprovedApplication = await Application.findOne({
            kill_id,
            item_id,
            status: 'approved'
        });
        if (existingApprovedApplication) {
            return res.status(400).json({
                code: 400,
                msg: '物品已被分配',
                detail: `此物品 (${item_name}) 已於 ${moment(existingApprovedApplication.updatedAt).format('YYYY-MM-DD HH:mm')} 分配給 ${existingApprovedApplication.user_id.character_name}，無法再次申請。`,
                suggestion: '請選擇其他未分配的物品。',
            });
        }

        // 檢查當前用戶是否已申請
        const existingApplication = await Application.findOne({
            user_id: user.id,
            kill_id,
            item_id,
            status: { $in: ['pending', 'approved'] }
        });
        if (existingApplication) {
            return res.status(400).json({
                code: 400,
                msg: '重複申請',
                detail: `您已為 ${item_name} 提交申請，狀態為 ${existingApplication.status}，無法再次申請。`,
                suggestion: '請等待審核結果或聯繫管理員。',
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
        if (application.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '僅能審批待處理的申請',
                detail: `申請 ID: ${id} 狀態為 ${application.status}，無法審批。`,
                suggestion: '請檢查申請狀態。',
            });
        }
        application.status = 'approved';
        await application.save();

        // 同步更新 BossKill
        const bossKill = await BossKill.findById(application.kill_id);
        if (bossKill) {
            bossKill.final_recipient = application.user_id.character_name;
            bossKill.status = 'assigned';
            await bossKill.save();
        }

        res.json({
            code: 200,
            msg: '申請已審批',
            detail: `申請 ID: ${id} 已審批，分配給 ${application.user_id.character_name}。`,
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

// 新增拒絕路由
router.put('/:id/reject', auth, adminOnly, async (req, res) => {
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
        if (application.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '僅能拒絕待處理的申請',
                detail: `申請 ID: ${id} 狀態為 ${application.status}，無法拒絕。`,
                suggestion: '請檢查申請狀態。',
            });
        }
        application.status = 'rejected';
        await application.save();

        res.json({
            code: 200,
            msg: '申請已拒絕',
            detail: `申請 ID: ${id} 已拒絕。`,
        });
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '拒絕申請失敗',
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
        const applications = await Application.find({ user_id: req.user.id })
            .select('user_id kill_id item_id item_name status created_at')
            .populate('user_id', 'character_name')
            .populate('kill_id', 'boss_name kill_time');
        console.log('Fetched applications from database:', applications);
        if (!applications || applications.length === 0) {
            console.warn('No applications found for user:', req.user.id);
            return res.json([]);
        }
        res.json(applications);
    } catch (err) {
        console.error('Fetch applications error:', err);
        res.status(500).json({ msg: '獲取申請記錄失敗', error: err.message });
    }
});

// 新增端點：根據 kill_id 和 item_id 查詢所有申請記錄（僅限管理員）
router.get('/by-kill-and-item', auth, adminOnly, async (req, res) => {
    const { kill_id, item_id } = req.query;

    try {
        if (!kill_id || !item_id) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `Missing required fields: ${!kill_id ? 'kill_id' : ''} ${!item_id ? 'item_id' : ''}`,
                suggestion: '請提供所有必填字段後重試。',
            });
        }

        const applications = await Application.find({
            kill_id,
            item_id,
            status: { $in: ['pending', 'approved'] }
        })
            .select('user_id status created_at')
            .populate('user_id', 'character_name');

        console.log(`Fetched applications for kill_id: ${kill_id}, item_id: ${item_id}:`, applications);
        res.json(applications);
    } catch (err) {
        console.error('Fetch applications by kill and item error:', err);
        res.status(500).json({ msg: '獲取申請記錄失敗', error: err.message });
    }
});

module.exports = router;