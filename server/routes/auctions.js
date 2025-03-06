const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const mongoose = require('mongoose');

// 獲取待處理競標數量
router.get('/pending-count', auth, async (req, res) => {
    //console.log('Fetching pending auctions count for user:', req.user?.character_name);
    try {
        const pendingCount = await Auction.countDocuments({
            status: 'pending',
        });
        //console.log('Pending auctions count:', pendingCount);
        res.json({ count: pendingCount });
    } catch (err) {
        console.error('Error fetching pending auctions count:', err);
        res.status(500).json({ msg: '獲取待處理競標數量失敗', error: err.message });
    }
});

// 創建競標
router.post('/auctions', auth, async (req, res) => {
    console.log('Received POST /api/auctions request:', req.body, 'User:', req.user?.character_name);
    const { itemId, startingPrice, endTime } = req.body;
    try {
        if (!itemId || !startingPrice || !endTime) {
            return res.status(400).json({ msg: 'itemId, startingPrice 和 endTime 為必填字段' });
        }
        const bossKillId = itemId.split('_')[0];
        if (!mongoose.Types.ObjectId.isValid(bossKillId)) {
            return res.status(400).json({ msg: '無效的 itemId 格式' });
        }
        const auction = new Auction({
            itemId: bossKillId,
            startingPrice: parseInt(startingPrice),
            currentPrice: parseInt(startingPrice),
            endTime: new Date(endTime),
            createdBy: req.user.id,
        });
        await auction.save();
        console.log('Auction created:', auction);
        res.status(201).json({ msg: '競標創建成功', auction });
    } catch (err) {
        console.error('Error creating auction:', err);
        res.status(500).json({ msg: '創建競標失敗', error: err.message });
    }
});

// 獲取競標列表
router.get('/', auth, async (req, res) => {
    console.log('Fetching auctions for user:', req.user?.character_name || 'Unknown', 'Token:', req.header('x-auth-token')?.substring(0, 20) + '...');
    const { status } = req.query;
    try {
        const query = status ? { status } : {};
        const auctions = await Auction.find(query)
            .populate({
                path: 'itemId',
                select: 'dropped_items', // 填充 dropped_items
            })
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name');
        console.log('Fetched auctions count:', auctions.length, 'Raw Data:', JSON.stringify(auctions, null, 2));
        if (!auctions.length) {
            console.log('No auctions found matching query:', query);
            return res.json([]);
        }
        // 解析 dropped_items，提取第一個 name 作為 itemName
        const enrichedAuctions = auctions.map(auction => {
            const itemName = auction.itemId?.dropped_items?.length
                ? auction.itemId.dropped_items[0].name
                : '未知物品';
            return {
                ...auction.toObject(),
                itemName,
            };
        });
        console.log('Enriched Auctions:', JSON.stringify(enrichedAuctions, null, 2));
        res.json(enrichedAuctions);
    } catch (err) {
        console.error('Error fetching auctions:', err);
        res.status(500).json({ msg: '獲取競標列表失敗', error: err.message });
    }
});

// 出價
router.post('/auctions/:id/bid', auth, async (req, res) => {
    const { amount } = req.body;
    try {
        const auction = await Auction.findById(req.params.id);
        if (!auction || auction.status !== 'active') {
            return res.status(400).json({ msg: '競標無效或已結束' });
        }
        if (amount <= auction.currentPrice) {
            return res.status(400).json({ msg: '出價必須高於當前價格' });
        }

        const user = await User.findById(req.user.id);
        if (!user || user.diamonds < amount) {
            return res.status(400).json({ msg: '鑽石不足' });
        }

        const bid = new Bid({
            auctionId: auction._id,
            userId: req.user.id,
            amount,
        });
        await bid.save();

        auction.currentPrice = amount;
        auction.highestBidder = req.user.id;
        await auction.save();

        user.diamonds -= amount;
        await user.save();

        res.json({ msg: '出價成功', bid });
    } catch (err) {
        res.status(500).json({ msg: '出價失敗', error: err.message });
    }
});

module.exports = router;