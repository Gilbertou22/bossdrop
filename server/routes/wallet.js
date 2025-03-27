// routes/wallet.js
const express = require('express');
const router = express.Router();
const WalletTransaction = require('../models/WalletTransaction');
const DKPRecord = require('../models/DKPRecord');
const { auth } = require('../middleware/auth');
const moment = require('moment');

router.get('/transactions', auth, async (req, res) => {
    try {
        const { page = 1, pageSize = 10, type, source, startDate, endDate, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;

        // 查詢條件
        const walletQuery = { userId: req.user.id };
        const dkpQuery = { userId: req.user.id };

        if (type) {
            walletQuery.type = type;
            dkpQuery.type = type;
        }
        if (source) {
            walletQuery.source = source;
            if (source !== 'dkp') {
                dkpQuery.type = null; // 如果來源不是 DKP，則不查詢 DKP 記錄
            }
        }
        if (startDate || endDate) {
            walletQuery.timestamp = {};
            dkpQuery.createdAt = {};
            if (startDate) {
                walletQuery.timestamp.$gte = new Date(startDate);
                dkpQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                walletQuery.timestamp.$lte = new Date(endDate);
                dkpQuery.createdAt.$lte = new Date(endDate);
            }
        }

        // 查詢 WalletTransaction
        const walletTransactions = await WalletTransaction.find(walletQuery)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip((page - 1) * pageSize)
            .limit(parseInt(pageSize))
            .lean();

        // 查詢 DKPRecord
        const dkpRecords = source && source !== 'dkp' ? [] : await DKPRecord.find(dkpQuery)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip((page - 1) * pageSize)
            .limit(parseInt(pageSize))
            .lean();

        // 將 DKP 記錄轉換為錢包交易格式
        const dkpTransactions = dkpRecords.map(record => ({
            _id: record._id,
            userId: record.userId,
            amount: record.amount,
            type: record.amount > 0 ? 'income' : 'expense',
            source: 'dkp',
            description: record.description,
            timestamp: record.createdAt,
        }));

        // 合併交易記錄
        const allTransactions = [...walletTransactions, ...dkpTransactions]
            .sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });

        // 分頁處理
        const total = await WalletTransaction.countDocuments(walletQuery) + await DKPRecord.countDocuments(dkpQuery);
        const paginatedTransactions = allTransactions.slice((page - 1) * pageSize, page * pageSize);

        res.json({
            transactions: paginatedTransactions,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
            },
        });
    } catch (err) {
        console.error('Error fetching wallet transactions:', err);
        res.status(500).json({
            code: 500,
            msg: '無法獲取錢包記錄',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.get('/transactions/export', auth, async (req, res) => {
    try {
        const { type, source, startDate, endDate } = req.query;

        const walletQuery = { userId: req.user.id };
        const dkpQuery = { userId: req.user.id };

        if (type) {
            walletQuery.type = type;
            dkpQuery.type = type;
        }
        if (source) {
            walletQuery.source = source;
            if (source !== 'dkp') {
                dkpQuery.type = null;
            }
        }
        if (startDate || endDate) {
            walletQuery.timestamp = {};
            dkpQuery.createdAt = {};
            if (startDate) {
                walletQuery.timestamp.$gte = new Date(startDate);
                dkpQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                walletQuery.timestamp.$lte = new Date(endDate);
                dkpQuery.createdAt.$lte = new Date(endDate);
            }
        }

        const walletTransactions = await WalletTransaction.find(walletQuery).lean();
        const dkpRecords = source && source !== 'dkp' ? [] : await DKPRecord.find(dkpQuery).lean();

        const dkpTransactions = dkpRecords.map(record => ({
            _id: record._id,
            userId: record.userId,
            amount: record.amount,
            type: record.amount > 0 ? 'income' : 'expense',
            source: 'dkp',
            description: record.description,
            timestamp: record.createdAt,
        }));

        const allTransactions = [...walletTransactions, ...dkpTransactions]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ transactions: allTransactions });
    } catch (err) {
        console.error('Error exporting wallet transactions:', err);
        res.status(500).json({
            code: 500,
            msg: '導出錢包記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;