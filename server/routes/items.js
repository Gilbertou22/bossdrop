const express = require('express');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Auction = require('../models/Auction'); // 導入 Auction 模型
const Item = require('../models/Item'); // 確認導入
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
            _id: { $nin: existingAuctions }, // 排除已發起競標的 _id
        }).select('_id dropped_items');

        console.log('Auctionable BossKills count:', auctionableBossKills.length, 'Data:', auctionableBossKills);

        // 映射 dropped_items 為可競標物品選項
        const auctionableItems = auctionableBossKills.reduce((acc, bossKill) => {
            const items = (bossKill.dropped_items || []).map(item => ({
                _id: `${bossKill._id}_${item.name}`, // 唯一 ID 結合 bossKill 和 item
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

// 獲取所有物品
router.get('/', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 創建物品（管理員）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, type, description } = req.body;
    try {
        const item = new Item({ name, type, description });
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新物品（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, type, description } = req.body;
    try {
        const item = await Item.findByIdAndUpdate(
            req.params.id,
            { name, type, description },
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

module.exports = router;