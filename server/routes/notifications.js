const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const mongoose = require('mongoose');

router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .lean();
        const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });
        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取通知失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.put('/:id/read', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的通知 ID',
                detail: `提供的 ID (${id}) 不是有效的 MongoDB ObjectId。`,
            });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { read: true },
            { new: true, lean: true }
        );
        if (!notification) {
            return res.status(404).json({
                code: 404,
                msg: '通知不存在',
                detail: `無法找到 ID 為 ${id} 的通知。`,
            });
        }

        res.json({ code: 200, msg: '標記為已讀成功', notification });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({
            code: 500,
            msg: '標記為已讀失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.post('/broadcast', auth, async (req, res) => {
    try {
        console.log('Broadcast request received, req.user:', req.user); // 調試 req.user
        if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員或審核員可以發送廣播通知。',
            });
        }

        const { message, auctionId } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                code: 400,
                msg: '無效的請求',
                detail: '消息內容為必填字段且必須為字符串。',
            });
        }

        const auctionIdValidation = auctionId ? mongoose.Types.ObjectId.isValid(auctionId) : true;
        if (auctionId && !auctionIdValidation) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${auctionId}) 不是有效的 MongoDB ObjectId。`,
            });
        }

        const users = await User.find({}, '_id');
        if (!users || users.length === 0) {
            return res.status(404).json({
                code: 404,
                msg: '無可用用戶',
                detail: '系統中無用戶可接收通知。',
            });
        }

        // 查詢發送人信息
        const sender = await User.findById(req.user.id).lean();
        console.log('Sender query result:', sender); // 調試 sender
        const senderName = sender?.character_name || '未知用戶';

        // 拼接發送人到消息
        const formattedMessage = `${senderName}：${message}`;
        console.log('Formatted message:', formattedMessage); // 調試 formattedMessage

        const notifications = users.map(user => new Notification({
            userId: user._id,
            message: formattedMessage, // 嵌入發送人信息
            auctionId: auctionId || null,
            read: false,
        }));

        await Notification.insertMany(notifications);

        res.status(201).json({
            code: 201,
            msg: '廣播通知發送成功',
            detail: `已向 ${users.length} 個用戶發送通知。`,
        });
    } catch (err) {
        console.error('Error broadcasting notification:', err);
        res.status(500).json({
            code: 500,
            msg: '發送廣播通知失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;