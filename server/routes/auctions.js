const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const BossKill = require('../models/BossKill');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const mongoose = require('mongoose');
const moment = require('moment');

// 獲取待處理競標數量
router.get('/pending-count', auth, async (req, res) => {
    try {
        const pendingCount = await Auction.countDocuments({ status: 'pending' });
        res.json({ count: pendingCount });
    } catch (err) {
        console.error('Error fetching pending auctions count:', err);
        res.status(500).json({ msg: '獲取待處理競標數量失敗', error: err.message });
    }
});

// 創建競標
router.post('/', auth, async (req, res) => {
    console.log('Received POST /api/auctions request:', req.body, 'User:', req.user?.character_name);
    const { itemId, startingPrice, buyoutPrice, endTime, status = 'active' } = req.body;
    try {
        if (!itemId || !startingPrice || !endTime) {
            return res.status(400).json({ msg: 'itemId, startingPrice 和 endTime 為必填字段' });
        }

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ msg: '無效的 itemId 格式' });
        }

        const bossKill = await BossKill.findById(itemId).populate('dropped_items');
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${itemId} 的擊殺記錄。`,
                suggestion: '請檢查 itemId 是否正確或聯繫管理員。',
            });
        }

        if (!bossKill.dropped_items || bossKill.dropped_items.length === 0) {
            return res.status(400).json({
                code: 400,
                msg: '無有效掉落物品',
                detail: `ID 為 ${itemId} 的擊殺記錄中無掉落物品。`,
                suggestion: '請檢查 BossKill 數據或聯繫管理員。',
            });
        }

        const startingPriceNum = parseInt(startingPrice);
        if (isNaN(startingPriceNum) || startingPriceNum < 100 || startingPriceNum > 9999) {
            return res.status(400).json({
                code: 400,
                msg: '起標價格無效',
                detail: '起標價格必須在 100 到 9999 之間。',
                suggestion: '請輸入有效的起標價格。',
            });
        }

        let buyoutPriceNum = buyoutPrice ? parseInt(buyoutPrice) : null;
        if (buyoutPrice && (isNaN(buyoutPriceNum) || buyoutPriceNum <= startingPriceNum)) {
            return res.status(400).json({
                code: 400,
                msg: '直接得標價無效',
                detail: `直接得標價必須大於起標價格 ${startingPriceNum}。`,
                suggestion: '請輸入有效的直接得標價。',
            });
        }

        const endTimeDate = new Date(endTime);
        const now = new Date();
        console.log('EndTime received:', endTime, 'Parsed:', endTimeDate, 'Now:', now);
        if (isNaN(endTimeDate.getTime()) || moment(endTimeDate).isBefore(moment(now))) {
            return res.status(400).json({
                code: 400,
                msg: '截止時間無效',
                detail: `截止時間 ${moment(endTimeDate).format('YYYY-MM-DD HH:mm:ss')} 必須晚於當前時間 ${moment(now).format('YYYY-MM-DD HH:mm:ss')}.`,
                suggestion: '請選擇一個未來的時間。',
            });
        }

        const auction = new Auction({
            itemId, // 保持為 ObjectId
            startingPrice: startingPriceNum,
            currentPrice: startingPriceNum,
            buyoutPrice: buyoutPriceNum,
            endTime: endTimeDate,
            createdBy: req.user.id,
            status: status,
        });
        await auction.save();
        console.log('Auction created with buyoutPrice:', { auction, buyoutPrice: auction.buyoutPrice });
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
            .lean() // 使用 lean() 獲取純粹的 JSON 對象
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name');
        console.log('Fetched auctions count:', auctions.length, 'Raw Data:', JSON.stringify(auctions, null, 2));
        if (!auctions.length) {
            console.log('No auctions found matching query:', query);
            return res.json([]);
        }

        const enrichedAuctions = await Promise.all(auctions.map(async (auction) => {
            let itemName = '未知物品';

            if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
                const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
                if (bossKill && bossKill.dropped_items?.length) {
                    // 假設使用第一個 dropped_item（可根據業務邏輯調整）
                    itemName = bossKill.dropped_items[0].name || '未知物品';
                }
            } else {
                console.warn(`Invalid itemId for auction ${auction._id}:`, auction.itemId);
            }

            return {
                ...auction,
                itemName, // 動態計算 itemName
                createdAt: auction.createdAt,
                endTime: auction.endTime,
                currentPrice: auction.currentPrice,
                startingPrice: auction.startingPrice,
                buyoutPrice: auction.buyoutPrice,
                status: auction.status || 'active',
            };
        }));

        console.log('Enriched Auctions:', JSON.stringify(enrichedAuctions, null, 2));
        res.json(enrichedAuctions);
    } catch (err) {
        console.error('Error fetching auctions:', err);
        res.status(500).json({ msg: '獲取競標列表失敗', error: err.message });
    }
});

// 獲取單個拍賣詳情
router.get('/:id', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請檢查拍賣 ID 或聯繫管理員。',
            });
        }

        const auction = await Auction.findById(id)
            .lean() // 使用 lean() 獲取純粹的 JSON 對象
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name');

        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }

        let itemName = '未知物品';

        if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
            const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
            if (bossKill && bossKill.dropped_items?.length) {
                // 假設使用第一個 dropped_item（可根據業務邏輯調整）
                itemName = bossKill.dropped_items[0].name || '未知物品';
            }
        } else {
            console.warn(`Invalid itemId for auction ${auction._id}:`, auction.itemId);
        }

        const enrichedAuction = {
            ...auction,
            itemName, // 動態計算 itemName
            createdAt: auction.createdAt,
            endTime: auction.endTime,
            currentPrice: auction.currentPrice,
            startingPrice: auction.startingPrice,
            buyoutPrice: auction.buyoutPrice,
            status: auction.status || 'active',
        };

        res.json(enrichedAuction);
    } catch (err) {
        console.error('Error fetching auction by ID:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取拍賣詳情失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 出價路由（移除餘額檢查）
router.post('/:id/bid', auth, async (req, res) => {
    const { amount } = req.body;
    const auctionId = req.params.id;
    const userId = req.user.id;

    try {
        console.log('Received bid request:', { auctionId, amount, userId, token: req.header('x-auth-token') });
        if (!amount || isNaN(amount)) {
            return res.status(400).json({
                code: 400,
                msg: '出價無效',
                detail: '請輸入有效的出價金額。',
                suggestion: '請檢查出價值。',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(auctionId)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${auctionId}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }

        const auction = await Auction.findById(auctionId);
        if (!auction) {
            console.warn(`Auction not found for ID: ${auctionId}`);
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${auctionId} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }

        console.log('Auction found:', auction);
        if (auction.status !== 'active') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣已結束或被取消',
                detail: `拍賣 ${auctionId} 的狀態為 ${auction.status}，無法出價。`,
                suggestion: '請選擇其他活躍拍賣。',
            });
        }

        if (moment(auction.endTime).isBefore(moment())) {
            auction.status = 'completed';
            await auction.save();
            return res.status(400).json({
                code: 400,
                msg: '拍賣已過期',
                detail: `拍賣 ${auctionId} 已於 ${moment(auction.endTime).format('YYYY-MM-DD HH:mm:ss')} 結束。`,
                suggestion: '請選擇其他活躍拍賣。',
            });
        }

        const bidValue = parseInt(amount);
        if (bidValue === auction.currentPrice) {
            return res.status(400).json({
                code: 400,
                msg: '出價無效',
                detail: `出價 ${bidValue} 不能等於當前價格 ${auction.currentPrice}。`,
                suggestion: '請輸入更高的出價金額。',
            });
        }
        if (bidValue < auction.currentPrice) {
            return res.status(400).json({
                code: 400,
                msg: '出價無效',
                detail: `出價 ${bidValue} 必須大於當前價格 ${auction.currentPrice}。`,
                suggestion: '請輸入更高的出價金額。',
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                code: 404,
                msg: '用戶不存在',
                detail: `無法找到 ID 為 ${userId} 的用戶。`,
                suggestion: '請重新登錄或聯繫管理員。',
            });
        }

        let finalPrice = bidValue;
        let buyoutTriggered = false;
        if (auction.buyoutPrice && bidValue >= auction.buyoutPrice) {
            finalPrice = auction.buyoutPrice;
            auction.status = 'completed';
            buyoutTriggered = true;
        }

        const bid = new Bid({
            auctionId: auction._id,
            userId,
            amount: finalPrice,
        });
        await bid.save();

        auction.currentPrice = finalPrice;
        auction.highestBidder = userId;
        await auction.save();

        res.status(200).json({
            code: 200,
            msg: buyoutTriggered ? '出價成功，已直接得標！' : '出價成功！',
            detail: `您已為拍賣 ${auctionId} 出價 ${finalPrice} 鑽石，結算時將扣除。${buyoutTriggered ? '競標已結束。' : ''}`,
        });
    } catch (err) {
        console.error('Error placing bid:', {
            error: err.message,
            stack: err.stack,
            response: err.response?.data,
        });
        res.status(500).json({
            code: 500,
            msg: '出價失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 結算路由（保留餘額檢查）
router.put('/:id/settle', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }

        const auction = await Auction.findById(id)
            .lean() // 使用 lean() 獲取純粹的 JSON 對象
            .populate('highestBidder', 'character_name');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }

        if (auction.status !== 'active' && auction.status !== 'completed') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，無法結算。`,
                suggestion: '請確保拍賣為活躍或已完成狀態。',
            });
        }

        if (moment(auction.endTime).isAfter(moment())) {
            return res.status(400).json({
                code: 400,
                msg: '拍賣尚未結束',
                detail: `拍賣 ${id} 將於 ${moment(auction.endTime).format('YYYY-MM-DD HH:mm:ss')} 結束，無法提前結算。`,
                suggestion: '請等待截止時間或取消拍賣。',
            });
        }

        const highestBidder = auction.highestBidder;
        if (!highestBidder) {
            await Auction.findByIdAndUpdate(id, { status: 'completed', highestBidder: null });
            return res.status(200).json({
                code: 200,
                msg: '拍賣結算完成，無中標者',
                detail: `拍賣 ${id} 無有效出價，已標記為完成。`,
            });
        }

        // 結算前檢查餘額並發送通知
        if (highestBidder.diamonds < auction.currentPrice) {
            let itemName = '未知物品';

            if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
                const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
                if (bossKill && bossKill.dropped_items?.length) {
                    // 假設使用第一個 dropped_item（可根據業務邏輯調整）
                    itemName = bossKill.dropped_items[0].name || '未知物品';
                }
            } else {
                console.warn(`Invalid itemId for auction ${auction._id}:`, auction.itemId);
            }

            const notification = new Notification({
                userId: highestBidder._id,
                message: `您的拍賣 ${itemName} (ID: ${id}) 結算時餘額不足（餘額: ${highestBidder.diamonds}，需: ${auction.currentPrice} 鑽石）。請充值後聯繫管理員。`,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, { status: 'pending' });
            return res.status(400).json({
                code: 400,
                msg: '中標者餘額不足',
                detail: `用戶 ${highestBidder.character_name} 鑽石餘額 (${highestBidder.diamonds}) 不足以支付 ${auction.currentPrice} 鑽石。`,
                suggestion: '請為用戶充值、取消拍賣或重新分配。',
            });
        }

        await User.findByIdAndUpdate(highestBidder._id, { $inc: { diamonds: -auction.currentPrice } });
        await Auction.findByIdAndUpdate(id, { status: 'completed' });

        res.status(200).json({
            code: 200,
            msg: '拍賣結算成功',
            detail: `用戶 ${highestBidder.character_name} 支付 ${auction.currentPrice} 鑽石，剩餘 ${highestBidder.diamonds - auction.currentPrice} 鑽石。`,
        });
    } catch (err) {
        console.error('Error settling auction:', err);
        res.status(500).json({
            code: 500,
            msg: '拍賣結算失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取出價歷史記錄
router.get('/:id/bids', auth, async (req, res) => {
    const auctionId = req.params.id;

    try {
        console.log('Fetching bids for auction:', auctionId);
        if (!mongoose.Types.ObjectId.isValid(auctionId)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的競標 ID',
                detail: '請提供有效的競標 ID。',
            });
        }

        const bids = await Bid.find({ auctionId })
            .populate('userId', 'character_name avatar')
            .sort({ created_at: -1 });

        console.log('Fetched bids:', bids);
        res.json(bids);
    } catch (err) {
        console.error('Error fetching bids:', {
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取出價歷史失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;