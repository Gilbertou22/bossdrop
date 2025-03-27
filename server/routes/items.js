const express = require('express');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Auction = require('../models/Auction');
const Item = require('../models/Item');
const ItemLevel = require('../models/ItemLevel');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取所有等級選項
router.get('/item-levels', async (req, res) => {
    try {
        const itemLevels = await ItemLevel.find().lean();
        res.json(itemLevels);
    } catch (err) {
        res.status(500).json({ msg: '獲取物品等級失敗', error: err.message });
    }
});

// 創建物品等級（管理員）
router.post('/item-levels', auth, adminOnly, async (req, res) => {
    const { level, color } = req.body;
    try {
        const existingLevel = await ItemLevel.findOne({ level });
        if (existingLevel) {
            return res.status(400).json({ msg: '該等級已存在，請使用其他名稱' });
        }
        const itemLevel = new ItemLevel({ level, color });
        await itemLevel.save();
        res.status(201).json(itemLevel);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新物品等級（管理員）
router.put('/item-levels/:id', auth, adminOnly, async (req, res) => {
    const { level, color } = req.body;
    try {
        const existingLevel = await ItemLevel.findOne({ level, _id: { $ne: req.params.id } });
        if (existingLevel) {
            return res.status(400).json({ msg: '該等級已存在，請使用其他名稱' });
        }
        const itemLevel = await ItemLevel.findByIdAndUpdate(
            req.params.id,
            { level, color },
            { new: true, runValidators: true }
        );
        if (!itemLevel) return res.status(404).json({ msg: '物品等級不存在' });
        res.json(itemLevel);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 刪除物品等級（管理員）
router.delete('/item-levels/:id', auth, adminOnly, async (req, res) => {
    try {
        const itemLevel = await ItemLevel.findByIdAndDelete(req.params.id);
        if (!itemLevel) return res.status(404).json({ msg: '物品等級不存在' });
        res.json({ msg: '物品等級已刪除' });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 獲取可競標物品（從 BossKill 表中，狀態為 expired 且 final_recipient 為 NULL，且未發起競標）
router.get('/auctionable', auth, async (req, res) => {
    console.log('Fetching auctionable items from BossKill for user:', req.user?.character_name);
    try {
        const query = {
            status: 'expired',
            'dropped_items.final_recipient': null,
        };
        console.log('Initial Query:', JSON.stringify(query, null, 2));

        const existingAuctions = await Auction.find().distinct('itemId');
        console.log('Existing Auction itemIds:', existingAuctions);

        const auctionableBossKills = await BossKill.find({
            ...query,
            'dropped_items._id': { $nin: existingAuctions },
        })
            .populate('bossId', 'name')
            .lean();

        console.log('Auctionable BossKills count:', auctionableBossKills.length, 'Data:', auctionableBossKills);

        const auctionableItems = auctionableBossKills.reduce((acc, bossKill) => {
            const items = (bossKill.dropped_items || [])
                .filter(item => !item.final_recipient && !existingAuctions.includes(item._id.toString()))
                .map(item => ({
                    _id: item._id.toString(),
                    name: item.name,
                    bossKillId: bossKill._id.toString(),
                    bossName: bossKill.bossId?.name || '未知首領',
                }));
            return [...acc, ...items];
        }, []);

        console.log('Mapped auctionable items:', auctionableItems);
        res.json(auctionableItems);
    } catch (err) {
        console.error('Error fetching auctionable items from BossKill:', {
            message: err.message,
            stack: err.stack,
            query: err.query || 'No query context',
        });
        res.status(500).json({ msg: '獲取可競標物品失敗', error: err.message });
    }
});

// 獲取所有物品（支持搜索和過濾）
router.get('/', async (req, res) => {
    try {
        const { search, type } = req.query;
        let query = {};
        if (type && type !== 'all') query.type = type;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }
        const items = await Item.find(query)
            .populate('level', 'level color')
            .lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 創建物品（管理員）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, type, description, imageUrl, level } = req.body;
    try {
        const existingItem = await Item.findOne({ name });
        if (existingItem) {
            return res.status(400).json({ msg: '物品名稱已存在，請使用其他名稱' });
        }
        const item = new Item({ name, type, description, imageUrl, level });
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新物品（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, type, description, imageUrl, level } = req.body;
    try {
        const existingItem = await Item.findOne({ name, _id: { $ne: req.params.id } });
        if (existingItem) {
            return res.status(400).json({ msg: '物品名稱已存在，請使用其他名稱' });
        }
        const item = await Item.findByIdAndUpdate(
            req.params.id,
            { name, type, description, imageUrl, level },
            { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ msg: '物品不存在' });
        res.json(item);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 刪除物品（管理員）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const item = await Item.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ msg: '物品不存在' });
        res.json({ msg: '物品已刪除' });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 批量刪除物品（管理員）
router.delete('/batch-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: '請提供有效的物品 ID 列表' });
        }
        const result = await Item.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ msg: '沒有找到任何物品進行刪除' });
        }
        res.json({ msg: `成功刪除 ${result.deletedCount} 個物品` });
    } catch (err) {
        res.status(500).json({ msg: '批量刪除失敗', error: err.message });
    }
});

module.exports = router;