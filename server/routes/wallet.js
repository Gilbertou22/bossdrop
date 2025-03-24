const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { auth } = require('../middleware/auth');
const WalletTransaction = require('../models/WalletTransaction');
const logger = require('../logger');

// 記錄一筆收支
router.post('/transactions', auth, async (req, res) => {
    const { userId, amount, type, source, description, auctionId } = req.body;
    try {
        // 驗證請求數據
        if (!userId || !amount || !type || !source) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必要字段',
                detail: 'userId, amount, type 和 source 為必填字段',
            });
        }
        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的類型',
                detail: 'type 必須為 income 或 expense',
            });
        }

        const transaction = new WalletTransaction({
            userId,
            amount,
            type,
            source,
            description,
            auctionId,
        });
        await transaction.save();

        logger.info('Wallet transaction created', { userId, amount, type, source, auctionId });
        res.status(201).json({
            code: 201,
            msg: '錢包記錄已創建',
            transaction,
        });
    } catch (err) {
        logger.error('Error creating wallet transaction', { error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '創建錢包記錄失敗',
            detail: err.message,
        });
    }
});

// 獲取用戶的錢包記錄（支持分頁和篩選）
router.get('/transactions', auth, async (req, res) => {
    const userId = req.user.id;
    const {
        page = 1,
        pageSize = 10,
        type, // 篩選類型：income 或 expense
        startDate, // 開始日期
        endDate, // 結束日期
        sortBy = 'timestamp', // 排序字段
        sortOrder = 'desc', // 排序順序：asc 或 desc
    } = req.query;

    try {
        // 構建查詢條件
        const query = { userId };
        if (type) query.type = type;
        if (startDate && endDate) {
            query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (startDate) {
            query.timestamp = { $gte: new Date(startDate) };
        } else if (endDate) {
            query.timestamp = { $lte: new Date(endDate) };
        }

        // 構建排序條件
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // 查詢記錄
        const transactions = await WalletTransaction.find(query)
            .sort(sort)
            .skip((page - 1) * pageSize)
            .limit(parseInt(pageSize))
            .lean()
            .populate('auctionId', 'itemName'); // 可選：如果需要顯示拍賣相關信息

        // 獲取總記錄數
        const total = await WalletTransaction.countDocuments(query);

        logger.info('Fetched wallet transactions', { userId, page, pageSize, total });
        res.json({
            code: 200,
            transactions,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
            },
        });
    } catch (err) {
        logger.error('Error fetching wallet transactions', { userId, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取錢包記錄失敗',
            detail: err.message,
        });
    }
});

// 獲取所有錢包記錄（用於導出 CSV）
router.get('/transactions/export', auth, async (req, res) => {
    const userId = req.user.id;
    const { type, startDate, endDate } = req.query;

    try {
        const query = { userId };
        if (type) query.type = type;
        if (startDate && endDate) {
            query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (startDate) {
            query.timestamp = { $gte: new Date(startDate) };
        } else if (endDate) {
            query.timestamp = { $lte: new Date(endDate) };
        }

        const transactions = await WalletTransaction.find(query)
            .sort({ timestamp: -1 })
            .lean()
            .populate('auctionId', 'itemName');

        logger.info('Exported wallet transactions', { userId, count: transactions.length });
        res.json({
            code: 200,
            transactions,
        });
    } catch (err) {
        logger.error('Error exporting wallet transactions', { userId, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '導出錢包記錄失敗',
            detail: err.message,
        });
    }
});

module.exports = router;