const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Application = require('../models/Application');
const Auction = require('../models/Auction');
const Guild = require('../models/Guild');
const Item = require('../models/Item');
const ItemLevel = require('../models/ItemLevel');
const Boss = require('../models/Boss');
const DKPRecord = require('../models/DKPRecord');
const User = require('../models/User');
const BossDKPSetting = require('../models/BossDKPSetting');
const multer = require('multer');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');
const moment = require('moment');

const upload = multer({
    storage: multer.diskStorage({
        destination: './uploads/',
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
    limits: { fileSize: 600 * 1024 },
});

// 獲取擊殺記錄列表
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, pageSize = 10, sortBy = 'kill_time', sortOrder = 'desc', bossId, start_time, end_time, status, keyword } = req.query;

        const query = {};
        if (bossId) query.bossId = bossId;
        if (start_time) query.kill_time = { $gte: new Date(start_time) };
        if (end_time) query.kill_time = { ...query.kill_time, $lte: new Date(end_time) };
        if (status) query.status = status;
        if (keyword) {
            query.$or = [
                { 'dropped_items.name': { $regex: keyword, $options: 'i' } },
                { itemHolder: { $regex: keyword, $options: 'i' } },
                { attendees: { $regex: keyword, $options: 'i' } },
            ];
        }

        const total = await BossKill.countDocuments(query);
        const bossKills = await BossKill.find(query)
            .populate('bossId')
            .populate('dropped_items.level')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip((page - 1) * pageSize)
            .limit(parseInt(pageSize));

        res.json({
            data: bossKills,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
            },
        });
    } catch (err) {
        res.status(500).json({ msg: '服務器錯誤', detail: err.message });
    }
});

// 獲取過期物品（移到更具體的路由之前）
router.get('/expired-items', auth, async (req, res) => {
    try {
        const now = new Date();
        const updateResult = await BossKill.updateMany(
            {
                status: 'pending',
                'dropped_items.apply_deadline': { $lt: now }
            },
            { $set: { status: 'expired' } }
        );
        logger.info('Updated BossKill records to expired', { modifiedCount: updateResult.modifiedCount });

        const expiredItems = await BossKill.aggregate([
            {
                $match: {
                    status: 'expired'
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    records: { $push: '$$ROOT' }
                }
            },
            {
                $project: {
                    _id: 0,
                    count: 1,
                    records: 1
                }
            },
            {
                $unwind: '$records'
            },
            {
                $lookup: {
                    from: 'auctions',
                    localField: 'records._id',
                    foreignField: 'itemId',
                    as: 'records.auctions'
                }
            },
            {
                $match: {
                    $or: [
                        { 'records.auctions': { $size: 0 } },
                        {
                            'records.auctions': {
                                $not: {
                                    $elemMatch: {
                                        status: { $in: ['active', 'pending'] }
                                    }
                                }
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'bosses',
                    localField: 'records.bossId',
                    foreignField: '_id',
                    as: 'records.bossId'
                }
            },
            {
                $unwind: {
                    path: '$records.bossId',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: '$records.dropped_items',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'itemlevels',
                    localField: 'records.dropped_items.level',
                    foreignField: '_id',
                    as: 'records.dropped_items.level'
                }
            },
            {
                $unwind: {
                    path: '$records.dropped_items.level',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    kill_id: '$records._id',
                    boss_name: { $ifNull: ['$records.bossId.name', '未知首領'] },
                    item_name: { $ifNull: ['$records.dropped_items.name', '未知物品'] },
                    apply_deadline: '$records.dropped_items.apply_deadline',
                    level: {
                        level: { $ifNull: ['$records.dropped_items.level.level', '一般'] },
                        color: { $ifNull: ['$records.dropped_items.level.color', '白色'] }
                    }
                }
            }
        ]);

        if (expiredItems.length === 0) {
            logger.info('No expired items found after filtering', { expiredItems });
            const expiredBossKills = await BossKill.find({ status: 'expired' }).lean();
            logger.info('Total expired BossKill records', { count: expiredBossKills.length, records: expiredBossKills });
            const auctionRecords = await Auction.find({}).lean();
            logger.info('Total Auction records', { count: auctionRecords.length, records: auctionRecords });
        }

        logger.info('Fetched expired items', { expiredItems });
        res.status(200).json(expiredItems);
    } catch (err) {
        logger.error('Get expired items error', { error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取可競標物品失敗',
            detail: err.message || '服務器錯誤',
        });
    }
});

// 獲取單個擊殺記錄詳情（移到動態路由之後）
router.get('/:id', auth, async (req, res) => {
    try {
        const bossKill = await BossKill.findById(req.params.id)
            .populate('bossId', 'name')
            .populate('dropped_items.level')
            .lean();
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的擊殺記錄。`,
            });
        }
        logger.info('Fetched boss kill details', { userId: req.user.id, bossKillId: req.params.id });
        res.json(bossKill);
    } catch (err) {
        logger.error('Error fetching boss kill by ID', { userId: req.user.id, bossKillId: req.params.id, error: err.message, stack: err.stack });
        res.status(500).json({
            msg: '獲取擊殺記錄詳情失敗',
            error: err.message,
        });
    }
});

// 獲取所有擊殺記錄（管理員專用）
router.get('/all', auth, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

    
        const bossKills = await BossKill.find()
            .sort({ kill_time: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('bossId', 'name description difficulty')
            .lean();

        const total = await BossKill.countDocuments();

        const enrichedKills = await Promise.all(bossKills.map(async (kill) => {
            const enrichedItems = await Promise.all(kill.dropped_items.map(async (item) => {
                const auction = await Auction.findOne({ itemId: item._id }).lean();
                const application = await Application.findOne({ item_id: item._id, status: 'approved' }).lean();

                const isAssigned = auction || application || item.final_recipient;
                const itemDoc = await Item.findOne({ name: item.name }).populate('level', 'level color').lean();
                let level = itemDoc?.level || null;

                if (!itemDoc || !level) {
                    console.warn(`Item "${item.name}" (ID: ${item._id}) has no associated Item record or level.`);
                    level = { level: '一般', color: '白色' };
                }

                return {
                    ...item,
                    final_recipient: auction?.highestBidder?.character_name ||
                        application?.user_id?.character_name ||
                        item.final_recipient ||
                        null,
                    isAssigned: !!isAssigned,
                    level,
                };
            }));
            return {
                ...kill,
                dropped_items: enrichedItems,
            };
        }));

   
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

// 更新擊殺記錄
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { status, final_recipient, attendees, dropped_items, itemHolder } = req.body;
    try {
        const bossKill = await BossKill.findById(req.params.id);
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                suggestion: '請檢查 ID 或聯繫管理員',
            });
        }

        if (status) bossKill.status = status;
        if (final_recipient) bossKill.final_recipient = final_recipient;
        if (attendees) bossKill.attendees = attendees;
        if (itemHolder) bossKill.itemHolder = itemHolder;

        if (dropped_items && Array.isArray(dropped_items)) {
            bossKill.dropped_items = bossKill.dropped_items.map(item => {
                const updatedItem = dropped_items.find(di => (di._id || di.id) === (item._id || item.id));
                if (updatedItem) {
                    return { ...item, ...updatedItem };
                }
                return item;
            });
            bossKill.markModified('dropped_items');
        }

        await bossKill.save();
        res.json({ msg: '擊殺記錄更新成功', bossKill });
    } catch (err) {
        console.error('Update boss kill error:', err);
        res.status(500).json({
            code: 500,
            msg: '更新擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 更新物品狀態
router.put('/:killId/items/:itemId', auth, adminOnly, async (req, res) => {
    try {
        const bossKill = await BossKill.findById(req.params.killId);
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                suggestion: '請檢查 killId',
            });
        }

        const itemIndex = bossKill.dropped_items.findIndex(i => (i._id || i.id).toString() === req.params.itemId);
        if (itemIndex === -1) {
            return res.status(404).json({
                code: 404,
                msg: '物品不存在',
                suggestion: '請檢查 itemId',
            });
        }

       

        bossKill.status = 'expired';
        await bossKill.save();       

        const updatedBossKill = await BossKill.findById(req.params.killId).lean();
       
        res.json({ msg: '物品狀態更新成功', bossKill: updatedBossKill });
    } catch (err) {
        console.error('Update item status error:', err);
        res.status(500).json({
            code: 500,
            msg: '更新物品狀態失敗',
            detail: err.message,
            suggestion: '請稍後重試或聯繫管理員',
        });
    }
});

// 創建擊殺記錄
router.post('/', auth, adminOnly, upload.array('screenshots', 5), async (req, res) => {
    const { bossId, kill_time, dropped_items, attendees, final_recipient, status, apply_deadline_days, itemHolder } = req.body;

    try {
        const screenshots = req.files.map(file => file.path);

        const boss = await Boss.findById(bossId);
        if (!boss) {
            return res.status(404).json({
                code: 404,
                msg: 'Boss 不存在',
                suggestion: '請檢查 bossId 是否正確',
            });
        }

        let parsedItems = JSON.parse(dropped_items);
        const items = await Promise.all(parsedItems.map(async item => {
            const itemDoc = await Item.findOne({ name: item.name }).populate('level', 'level color').lean();
            if (!itemDoc || !itemDoc.level) {
                return res.status(400).json({
                    code: 400,
                    msg: `物品 ${item.name} 未找到或未定義等級`,
                    suggestion: '請確保物品存在於 Item 表中且已設置等級',
                });
            }
            return {
                _id: new mongoose.Types.ObjectId(),
                name: item.name,
                type: item.type,
                apply_deadline: new Date(new Date(kill_time).getTime() + (apply_deadline_days || 7) * 24 * 60 * 60 * 1000),
                final_recipient: null,
                level: itemDoc.level._id,
            };
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

        const results = [];
        for (const item of items) {
            const bossKill = new BossKill({
                bossId,
                kill_time,
                dropped_items: [item],
                attendees: parsedAttendees,
                screenshots,
                final_recipient: final_recipient || null,
                status: status || 'pending',
                userId: req.user.id,
                itemHolder: itemHolder || null,
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

// 分配 DKP 點數
router.post('/distribute/:killId', auth, adminOnly, async (req, res) => {
    try {
        const bossKill = await BossKill.findById(req.params.killId).populate('bossId');
        if (!bossKill) {
            return res.status(404).json({ msg: '擊殺記錄不存在' });
        }

        if (bossKill.dkpDistributed) {
            return res.status(400).json({ msg: '該擊殺記錄已分配 DKP 點數' });
        }

        const setting = await BossDKPSetting.findOne({ bossId: bossKill.bossId._id });
        if (!setting) {
            return res.status(404).json({ msg: `未找到 ${bossKill.bossId.name} 的 DKP 設定` });
        }

        const dkpPoints = setting.dkpPoints;
        const attendees = bossKill.attendees;

        const dkpRecords = await Promise.all(attendees.map(async attendee => {
            const user = await User.findOne({ character_name: attendee });
            if (!user) {
                console.warn(`User ${attendee} not found for DKP distribution.`);
                return null;
            }

            user.dkpPoints = (user.dkpPoints || 0) + dkpPoints;
            await user.save();

            const dkpRecord = new DKPRecord({
                userId: user._id,
                amount: dkpPoints,
                type: 'participation',
                description: `參與討伐 ${bossKill.bossId.name}`,
                bossKillId: bossKill._id,
            });
            await dkpRecord.save();

            return dkpRecord;
        }));

        bossKill.dkpDistributed = true;
        await bossKill.save();

        res.json({ msg: 'DKP 點數分配成功', dkpRecords: dkpRecords.filter(record => record !== null) });
    } catch (err) {
        console.error('Error distributing DKP:', err);
        res.status(500).json({ msg: 'DKP 點數分配失敗', error: err.message });
    }
});

// 批量刪除擊殺記錄
router.post('/batch-delete', auth, adminOnly, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的擊殺記錄 ID 陣列',
                suggestion: '檢查 ids 格式，例如 ["id1", "id2"]',
            });
        }

        const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                code: 400,
                msg: '包含無效的擊殺記錄 ID',
                detail: `無效的 ID: ${invalidIds.join(', ')}`,
                suggestion: '請提供有效的 ObjectId',
            });
        }

        const result = await BossKill.deleteMany({ _id: { $in: ids } });
        res.json({ msg: '批量刪除成功', deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Batch delete boss kills error:', err);
        res.status(500).json({
            code: 500,
            msg: '批量刪除擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 批量設為已過期
router.post('/batch-set-expired', auth, adminOnly, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的物品陣列',
                suggestion: '檢查 items 格式，例如 [{ killId: "id1", itemId: "item1" }, ...]',
            });
        }

        const updatedItems = [];
        for (const { killId, itemId } of items) {
            if (!mongoose.Types.ObjectId.isValid(killId) || !mongoose.Types.ObjectId.isValid(itemId)) {
                continue;
            }

            const bossKill = await BossKill.findById(killId);
            if (!bossKill) {
                continue;
            }

            const itemIndex = bossKill.dropped_items.findIndex(i => (i._id || i.id).toString() === itemId);
            if (itemIndex === -1) {
                continue;
            }

            bossKill.status = 'expired';
            await bossKill.save();
            updatedItems.push({ killId, itemId });
        }

        res.json({ msg: '批量設置物品狀態成功', updatedItems });
    } catch (err) {
        console.error('Batch set items expired error:', err);
        res.status(500).json({
            code: 500,
            msg: '批量設置物品狀態失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 添加 DELETE /:id 路由，支援單個擊殺記錄的刪除
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的擊殺記錄 ID',
                detail: `提供的 ID (${id}) 不是有效的 MongoDB ObjectId。`,
            });
        }

        const bossKill = await BossKill.findById(id);
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${id} 的擊殺記錄。`,
            });
        }

        await BossKill.deleteOne({ _id: id });
        logger.info('Boss kill deleted successfully', { userId: req.user.id, bossKillId: id });
        res.json({ msg: '擊殺記錄刪除成功' });
    } catch (err) {
        logger.error('Delete boss kill error', { userId: req.user.id, bossKillId: req.params.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '刪除擊殺記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;