const express = require('express');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Auction = require('../models/Auction');
const Item = require('../models/Item');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取可競標物品（從 BossKill 表中，狀態為 expired 且 final_recipient 為 NULL，且未發起競標）
router.get('/auctionable', auth, async (req, res) => {
    console.log('Fetching auctionable items from BossKill for user:', req.user?.character_name);
    try {
        const query = {
            status: 'expired',
            final_recipient: null,
        };
        console.log('Initial Query:', JSON.stringify(query, null, 2));

        // 獲取所有已發起競標的 BossKill _id
        const existingAuctions = await Auction.find().distinct('itemId');
        console.log('Existing Auction itemIds:', existingAuctions);

        // 篩選出未發起競標的 BossKill
        const auctionableBossKills = await BossKill.find({
            ...query,
            _id: { $nin: existingAuctions },
        }).select('_id dropped_items');

        console.log('Auctionable BossKills count:', auctionableBossKills.length, 'Data:', auctionableBossKills);

        // 映射 dropped_items 為可競標物品選項
        const auctionableItems = auctionableBossKills.reduce((acc, bossKill) => {
            const items = (bossKill.dropped_items || []).map(item => ({
                _id: `${bossKill._id}_${item.name}`,
                name: item.name,
                bossKillId: bossKill._id,
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
        const items = await Item.find(query).lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 創建物品（管理員）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, type, description, imageUrl } = req.body;
    try {
        // 檢查名稱是否唯一
        const existingItem = await Item.findOne({ name });
        if (existingItem) {
            return res.status(400).json({ msg: '物品名稱已存在，請使用其他名稱' });
        }
        const item = new Item({ name, type, description, imageUrl });
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新物品（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, type, description, imageUrl } = req.body;
    try {
        // 檢查名稱是否與其他物品衝突
        const existingItem = await Item.findOne({ name, _id: { $ne: req.params.id } });
        if (existingItem) {
            return res.status(400).json({ msg: '物品名稱已存在，請使用其他名稱' });
        }
        const item = await Item.findByIdAndUpdate(
            req.params.id,
            { name, type, description, imageUrl },
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