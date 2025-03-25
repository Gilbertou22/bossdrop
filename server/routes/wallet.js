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

// 獲取錢包交易記錄
router.get('/transactions', auth, async (req, res) => {
    const { page = 1, pageSize = 10, type, startDate, endDate, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    try {
        const query = { userId: req.user.id };
        if (type) query.type = type;
        if (startDate && endDate) {
            query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const total = await WalletTransaction.countDocuments(query);
        const transactions = await WalletTransaction.find(query)
            .lean() // 使用 .lean() 將 Mongoose 文檔轉為普通 JavaScript 對象
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip((page - 1) * pageSize)
            .limit(parseInt(pageSize));

        // 確保 auctionId 是字符串
        const formattedTransactions = transactions.map(transaction => ({
            ...transaction,
            auctionId: transaction.auctionId ? transaction.auctionId.toString() : null,
        }));

        logger.info('Fetched wallet transactions', { userId: req.user.id, count: transactions.length });
        res.json({
            transactions: formattedTransactions,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
            },
        });
    } catch (err) {
        logger.error('Error fetching wallet transactions', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取錢包交易記錄失敗', error: err.message });
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