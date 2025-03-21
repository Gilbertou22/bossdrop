const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const BossKill = require('../models/BossKill');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const logger = require('../logger');
const moment = require('moment');

// 監控拍賣（管理員專用）
router.get('/monitor', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const now = new Date();
        const soonEndingCount = await Auction.countDocuments({
            status: 'active',
            endTime: { $lt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        });
        const alertAuctions = await Auction.find({
            status: 'active',
            $or: [
                { currentPrice: { $gt: 0 }, highestBidder: { $exists: false } },
                { endTime: { $lt: now } },
            ],
        }).lean();
        logger.info('Fetched auction monitor data', { userId: req.user.id, soonEndingCount, alertAuctionsCount: alertAuctions.length });
        res.json({ soonEndingCount, alertAuctions });
    } catch (err) {
        logger.error('Error fetching auction monitor', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ code: 500, msg: '獲取拍賣監測失敗' });
    }
});

// 獲取拍賣成交趨勢（管理員專用）
router.get('/trend', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const now = new Date();
        const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const trendData = await Auction.aggregate([
            {
                $match: {
                    status: 'completed',
                    updatedAt: { $gte: startDate, $lte: now },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
                    },
                    count: { $sum: 1 },
                    totalPrice: { $sum: '$currentPrice' },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        logger.info('Fetched auction trend data', { userId: req.user.id, trendDataCount: trendData.length });
        res.json(trendData);
    } catch (err) {
        logger.error('Error fetching auction trend', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ code: 500, msg: '獲取拍賣成交趨勢失敗' });
    }
});

// 獲取待處理競標數量
router.get('/pending-count', auth, async (req, res) => {
    try {
        const pendingCount = await Auction.countDocuments({ status: 'pending' });
        logger.info('Fetched pending auctions count', { userId: req.user.id, pendingCount });
        res.json({ count: pendingCount });
    } catch (err) {
        logger.error('Error fetching pending auctions count', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取待處理競標數量失敗', error: err.message });
    }
});

// 獲取當前用戶得標或持有的拍賣列表
router.get('/won', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const characterName = req.user.character_name; // 獲取當前用戶的 character_name

        // 查詢條件：用戶是得標者（highestBidder）或物品持有人（itemHolder）
        const wonAuctions = await Auction.find({
            $or: [
                { highestBidder: userId }, // 用戶是得標者
                { itemHolder: characterName }, // 用戶是物品持有人
            ],
            status: { $in: ['completed', 'pending', 'settled'] },
        })
            .lean()
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name lineId discordId')
            .populate('itemId');

        if (!wonAuctions.length) {
            logger.info('No won or held auctions found for user', { userId, characterName });
            return res.json([]);
        }

        logger.info('Fetched won or held auctions', { userId, characterName, count: wonAuctions.length });

        const enrichedAuctions = await Promise.all(wonAuctions.map(async (auction) => {
            let itemName = '未知物品';
            let imageUrl = null;
            let level = null;
            let itemHolder = auction.itemHolder;

            if (auction.itemId && auction.itemId.itemHolder) {
                itemHolder = auction.itemId.itemHolder;
            } else {
                itemHolder = auction.createdBy.character_name;
                logger.warn(`itemHolder not set in BossKill for itemId ${auction.itemId?._id}, using createdBy.character_name`, { auctionId: auction._id, createdBy: auction.createdBy.character_name });
            }

            if (mongoose.Types.ObjectId.isValid(auction.itemId?._id)) {
                const bossKill = auction.itemId;
                if (bossKill && bossKill.dropped_items?.length) {
                    itemName = bossKill.dropped_items[0].name || '未知物品';
                    if (bossKill.screenshots?.length > 0) {
                        const rawImageUrl = bossKill.screenshots[0];
                        imageUrl = `${req.protocol}://${req.get('host')}/${rawImageUrl.replace(/\\/g, '/')}`;
                    }
                    const item = await Item.findOne({ name: itemName }).populate('level');
                    if (item) {
                        level = item.level || null;
                    }
                }
            } else {
                logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
            }

            return {
                ...auction,
                itemName,
                imageUrl,
                level,
                createdAt: auction.createdAt,
                endTime: auction.endTime,
                currentPrice: auction.currentPrice,
                startingPrice: auction.startingPrice,
                buyoutPrice: auction.buyoutPrice,
                status: auction.status || 'active',
                itemHolder,
            };
        }));
        res.json(enrichedAuctions);
    } catch (err) {
        logger.error('Error fetching won or held auctions', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取得標或持有拍賣列表失敗', error: err.message });
    }
});

// 創建競標
router.post('/', auth, async (req, res) => {
    const { itemId, startingPrice, buyoutPrice, endTime, status = 'active' } = req.body;
    try {
        logger.info('Creating new auction', { userId: req.user.id, itemId, startingPrice, buyoutPrice, endTime });
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
        if (isNaN(endTimeDate.getTime()) || moment(endTimeDate).isBefore(moment(now))) {
            return res.status(400).json({
                code: 400,
                msg: '截止時間無效',
                detail: `截止時間 ${moment(endTimeDate).format('YYYY-MM-DD HH:mm:ss')} 必須晚於當前時間 ${moment(now).format('YYYY-MM-DD HH:mm:ss')}.`,
                suggestion: '請選擇一個未來的時間。',
            });
        }

        const auction = new Auction({
            itemId,
            startingPrice: startingPriceNum,
            currentPrice: startingPriceNum,
            buyoutPrice: buyoutPriceNum,
            endTime: endTimeDate,
            createdBy: req.user.id,
            status,
            itemHolder: bossKill.itemHolder || req.user.character_name, // 從 BossKill 中獲取 itemHolder
        });
        await auction.save();
        logger.info('Auction created successfully', { userId: req.user.id, auctionId: auction._id, itemHolder: auction.itemHolder });
        res.status(201).json({ msg: '競標創建成功', auction });
    } catch (err) {
        logger.error('Error creating auction', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '創建競標失敗', error: err.message });
    }
});

// 獲取競標列表
router.get('/', auth, async (req, res) => {
    const { status } = req.query;
    try {
        const query = status ? { status } : {};
        const auctions = await Auction.find(query)
            .lean()
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name')
            .populate('itemId'); // 關聯 BossKill 數據
        if (!auctions.length) {
            logger.info('No auctions found', { userId: req.user.id, query });
            return res.json([]);
        }

        logger.info('Fetched auctions', { userId: req.user.id, count: auctions.length });

        const enrichedAuctions = await Promise.all(auctions.map(async (auction) => {
            let itemName = '未知物品';
            let imageUrl = null;
            let level = null;
            let itemHolder = auction.itemHolder;

            if (auction.itemId && auction.itemId.itemHolder) {
                itemHolder = auction.itemId.itemHolder;
            }

            if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
                const bossKill = auction.itemId;
                if (bossKill && bossKill.dropped_items?.length) {
                    itemName = bossKill.dropped_items[0].name || '未知物品';
                    if (bossKill.screenshots?.length > 0) {
                        const rawImageUrl = bossKill.screenshots[0];
                        imageUrl = `${req.protocol}://${req.get('host')}/${rawImageUrl.replace(/\\/g, '/')}`;
                    }
                    const item = await Item.findOne({ name: itemName }).populate('level');
                    if (item) {
                        level = item.level || null;
                    }
                }
            } else {
                logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
            }

            return {
                ...auction,
                itemName,
                imageUrl,
                level,
                createdAt: auction.createdAt,
                endTime: auction.endTime,
                currentPrice: auction.currentPrice,
                startingPrice: auction.startingPrice,
                buyoutPrice: auction.buyoutPrice,
                status: auction.status || 'active',
                itemHolder,
            };
        }));
        res.json(enrichedAuctions);
    } catch (err) {
        logger.error('Error fetching auctions', { userId: req.user.id, error: err.message, stack: err.stack });
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
            .lean()
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name')
            .populate('itemId');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        let itemName = '未知物品';
        let imageUrl = null;
        let level = null;
        let itemHolder = auction.itemHolder;

        if (auction.itemId && auction.itemId.itemHolder) {
            itemHolder = auction.itemId.itemHolder;
        }

        if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
            const bossKill = auction.itemId;
            if (bossKill && bossKill.dropped_items?.length) {
                itemName = bossKill.dropped_items[0].name || '未知物品';
                if (bossKill.screenshots?.length > 0) {
                    const rawImageUrl = bossKill.screenshots[0];
                    imageUrl = `${req.protocol}://${req.get('host')}/${rawImageUrl.replace(/\\/g, '/')}`;
                }
                const item = await Item.findOne({ name: itemName }).populate('level');
                if (item) {
                    level = item.level || null;
                }
            }
        } else {
            logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
        }

        const enrichedAuction = {
            ...auction,
            itemName,
            imageUrl,
            level,
            createdAt: auction.createdAt,
            endTime: auction.endTime,
            currentPrice: auction.currentPrice,
            startingPrice: auction.startingPrice,
            buyoutPrice: auction.buyoutPrice,
            status: auction.status || 'active',
            itemHolder,
        };
        logger.info('Fetched auction details', { userId: req.user.id, auctionId: id });
        res.json(enrichedAuction);
    } catch (err) {
        logger.error('Error fetching auction by ID', { userId: req.user.id, auctionId: id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取拍賣詳情失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 出價路由
router.post('/:id/bid', auth, async (req, res) => {
    const { amount } = req.body;
    const auctionId = req.params.id;
    const userId = req.user.id;
    try {
        logger.info('Received bid request', { auctionId, amount, userId });
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
            logger.warn(`Auction not found for ID: ${auctionId}`);
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${auctionId} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
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
        logger.info('Bid placed successfully', { auctionId, userId, finalPrice, buyoutTriggered });
        res.status(200).json({
            code: 200,
            msg: buyoutTriggered ? '下標成功，已直接得標！' : '下標成功！',
            detail: `您已為拍賣 ${auctionId} 下標 ${finalPrice} 鑽石，結算時將扣除。${buyoutTriggered ? '競標已結束。' : ''}`,
            finalPrice,
        });
    } catch (err) {
        logger.error('Error placing bid', { auctionId, userId, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '下標失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 結算路由
router.put('/:id/settle', auth, async (req, res) => {
    const { id } = req.params;
    try {
        logger.info('Attempting to settle auction', { auctionId: id, userId: req.user.id });
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
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
            logger.info('Auction settled with no bidder', { auctionId: id, userId: req.user.id });
            return res.status(200).json({
                code: 200,
                msg: '拍賣結算完成，無中標者',
                detail: `拍賣 ${id} 無有效出價，已標記為完成。`,
            });
        }
        let finalPrice = auction.currentPrice;
        if (auction.buyoutPrice && auction.currentPrice > auction.buyoutPrice) {
            finalPrice = auction.buyoutPrice;
        }
        if (highestBidder.diamonds < finalPrice) {
            let itemName = '未知物品';
            if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
                const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
                if (bossKill && bossKill.dropped_items?.length) {
                    itemName = bossKill.dropped_items[0].name || '未知物品';
                }
            }
            const formattedMessage = `系統：您的拍賣 ${itemName} (ID: ${id}) 結算時餘額不足（餘額: ${highestBidder.diamonds}，需: ${finalPrice} 鑽石）。請充值後聯繫管理員。`;
            const notification = new Notification({
                userId: highestBidder._id,
                message: formattedMessage,
                auctionId: id,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, { status: 'pending' });
            logger.warn('Highest bidder has insufficient diamonds', { auctionId: id, userId: highestBidder._id, diamonds: highestBidder.diamonds, finalPrice });
            return res.status(400).json({
                code: 400,
                msg: '中標者餘額不足',
                detail: `用戶 ${highestBidder.character_name} 鑽石餘額 (${highestBidder.diamonds}) 不足以支付 ${finalPrice} 鑽石。`,
                suggestion: '請為用戶充值、取消拍賣或重新分配。',
            });
        }
        await User.findByIdAndUpdate(highestBidder._id, { $inc: { diamonds: -finalPrice } });
        await Auction.findByIdAndUpdate(id, { status: 'completed' });
        logger.info('Auction settled successfully', { auctionId: id, userId: req.user.id, finalPrice, highestBidder: highestBidder._id });
        res.status(200).json({
            code: 200,
            msg: '拍賣結算成功',
            detail: `用戶 ${highestBidder.character_name} 支付 ${finalPrice} 鑽石，剩餘 ${highestBidder.diamonds - finalPrice} 鑽石。`,
        });
    } catch (err) {
        logger.error('Error settling auction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '拍賣結算失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 取消拍賣路由
router.put('/:id/cancel', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員可以取消拍賣。',
            });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .lean()
            .populate('highestBidder', 'character_name');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        if (auction.status !== 'active' && auction.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，無法取消。`,
                suggestion: '只有活躍或待處理狀態的拍賣可以被取消。',
            });
        }
        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
            const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
            if (bossKill && bossKill.dropped_items?.length) {
                itemName = bossKill.dropped_items[0].name || '未知物品';
            }
        }
        const bids = await Bid.find({ auctionId: id }).populate('userId', 'character_name');
        const bidders = bids.map(bid => bid.userId);
        const notifications = bidders.map(bidder => new Notification({
            userId: bidder._id,
            message: `拍賣 ${itemName} (ID: ${id}) 已被管理員取消。`,
            auctionId: id,
        }));
        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
        await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
        logger.info('Auction cancelled successfully', { auctionId: id, userId: req.user.id });
        res.status(200).json({
            code: 200,
            msg: '拍賣已取消',
            detail: `拍賣 ${id} 已成功取消，所有出價者已收到通知。`,
        });
    } catch (err) {
        logger.error('Error cancelling auction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '取消拍賣失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 重新分配拍賣路由
router.put('/:id/reassign', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員可以重新分配拍賣。',
            });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .populate('highestBidder', 'character_name');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        if (auction.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，無法重新分配。`,
                suggestion: '只有待處理狀態的拍賣可以被重新分配。',
            });
        }
        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
            const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
            if (bossKill && bossKill.dropped_items?.length) {
                itemName = bossKill.dropped_items[0].name || '未知物品';
            }
        }
        const bids = await Bid.find({ auctionId: id })
            .populate('userId', 'character_name diamonds')
            .sort({ amount: -1 });
        if (!bids.length) {
            await Auction.findByIdAndUpdate(id, { status: 'completed', highestBidder: null });
            logger.info('Auction ended with no bidders after reassignment', { auctionId: id, userId: req.user.id });
            return res.status(200).json({
                code: 200,
                msg: '拍賣已結束，無中標者',
                detail: `拍賣 ${id} 無有效出價，已標記為完成。`,
            });
        }
        const currentHighestBidderId = auction.highestBidder ? auction.highestBidder._id.toString() : null;
        const nextHighestBid = bids.find(bid => bid.userId._id.toString() !== currentHighestBidderId);
        if (!nextHighestBid) {
            const notification = new Notification({
                userId: currentHighestBidderId,
                message: `您的拍賣 ${itemName} (ID: ${id}) 因無其他出價者已被結束。`,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, { status: 'completed', highestBidder: null });
            logger.info('Auction ended with no other bidders after reassignment', { auctionId: id, userId: req.user.id });
            return res.status(200).json({
                code: 200,
                msg: '拍賣已結束，無其他出價者',
                detail: `拍賣 ${id} 無其他出價者，已標記為完成。`,
            });
        }
        const nextHighestBidder = nextHighestBid.userId;
        if (nextHighestBidder.diamonds < nextHighestBid.amount) {
            const notification = new Notification({
                userId: nextHighestBidder._id,
                message: `您的拍賣 ${itemName} (ID: ${id}) 已被重新分配給您，但您的餘額不足（餘額: ${nextHighestBidder.diamonds}，需: ${nextHighestBid.amount} 鑽石）。請充值後聯繫管理員。`,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, {
                highestBidder: nextHighestBidder._id,
                currentPrice: nextHighestBid.amount,
                status: 'pending',
            });
            logger.warn('Next highest bidder has insufficient diamonds after reassignment', { auctionId: id, userId: nextHighestBidder._id, diamonds: nextHighestBidder.diamonds, amount: nextHighestBid.amount });
            return res.status(400).json({
                code: 400,
                msg: '次高出價者餘額不足',
                detail: `用戶 ${nextHighestBidder.character_name} 鑽石餘額 (${nextHighestBidder.diamonds}) 不足以支付 ${nextHighestBid.amount} 鑽石。`,
                suggestion: '請為用戶充值或再次重新分配。',
            });
        }
        if (currentHighestBidderId) {
            const notification = new Notification({
                userId: currentHighestBidderId,
                message: `您的拍賣 ${itemName} (ID: ${id}) 因餘額不足已被重新分配給其他出價者。`,
                auctionId: id,
            });
            await notification.save();
        }
        const notification = new Notification({
            userId: nextHighestBidder._id,
            message: `拍賣 ${itemName} (ID: ${id}) 已被重新分配給您，您的出價為 ${nextHighestBid.amount} 鑽石。請確保結算前餘額足夠。`,
            auctionId: id,
        });
        await notification.save();
        await Auction.findByIdAndUpdate(id, {
            highestBidder: nextHighestBidder._id,
            currentPrice: nextHighestBid.amount,
            status: 'completed',
        });
        await User.findByIdAndUpdate(nextHighestBidder._id, { $inc: { diamonds: -nextHighestBid.amount } });
        logger.info('Auction reassigned successfully', { auctionId: id, userId: req.user.id, newHighestBidder: nextHighestBidder._id, amount: nextHighestBid.amount });
        res.status(200).json({
            code: 200,
            msg: '拍賣重新分配成功',
            detail: `拍賣 ${id} 已重新分配給用戶 ${nextHighestBidder.character_name}，出價為 ${nextHighestBid.amount} 鑽石。`,
        });
    } catch (err) {
        logger.error('Error reassigning auction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '重新分配拍賣失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取出價歷史記錄
router.get('/:id/bids', auth, async (req, res) => {
    const auctionId = req.params.id;
    try {
        logger.info('Fetching bids for auction', { auctionId, userId: req.user.id });
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
        logger.info('Fetched bids', { auctionId, userId: req.user.id, count: bids.length });
        res.json(bids);
    } catch (err) {
        logger.error('Error fetching bids', { auctionId, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取出價歷史失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 回報交易完成並觸發結算
router.put('/:id/complete-transaction', auth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        logger.info('User attempting to complete transaction', { auctionId: id, userId });
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name')
            .populate('itemId'); // 關聯 BossKill 數據
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        // 從 BossKill 中獲取 itemHolder
        let itemHolder = auction.itemHolder;
        if (auction.itemId && auction.itemId.itemHolder) {
            itemHolder = auction.itemId.itemHolder;
        }
        // 驗證是否為物品持有人
        if (itemHolder !== req.user.character_name) {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有物品持有人可以回報交易完成。',
            });
        }
        // 驗證拍賣狀態
        if (auction.status !== 'completed') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，無法回報交易完成。`,
                suggestion: '請確保拍賣已完成（status: completed）。',
            });
        }
        // 驗證中標者
        const highestBidder = auction.highestBidder;
        if (!highestBidder) {
            return res.status(400).json({
                code: 400,
                msg: '無中標者',
                detail: `拍賣 ${id} 無中標者，無法結算。`,
            });
        }
        // 計算最終金額
        let finalPrice = auction.currentPrice;
        if (auction.buyoutPrice && auction.currentPrice > auction.buyoutPrice) {
            finalPrice = auction.buyoutPrice;
        }
        // 檢查中標者餘額
        const bidder = await User.findById(highestBidder._id);
        if (bidder.diamonds < finalPrice) {
            let itemName = '未知物品';
            if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
                const bossKill = auction.itemId;
                if (bossKill && bossKill.dropped_items?.length) {
                    itemName = bossKill.dropped_items[0].name || '未知物品';
                }
            }
            const formattedMessage = `系統：您的拍賣 ${itemName} (ID: ${id}) 結算時餘額不足（餘額: ${bidder.diamonds}，需: ${finalPrice} 鑽石）。請充值後聯繫管理員。`;
            const notification = new Notification({
                userId: highestBidder._id,
                message: formattedMessage,
                auctionId: id,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, { status: 'pending' });
            logger.warn('Highest bidder has insufficient diamonds during transaction completion', { auctionId: id, userId: highestBidder._id, diamonds: bidder.diamonds, finalPrice });
            return res.status(400).json({
                code: 400,
                msg: '中標者餘額不足',
                detail: `用戶 ${highestBidder.character_name} 鑽石餘額 (${bidder.diamonds}) 不足以支付 ${finalPrice} 鑽石。`,
                suggestion: '請為用戶充值、取消拍賣或重新分配。',
            });
        }
        // 扣除中標者鑽石
        await User.findByIdAndUpdate(highestBidder._id, { $inc: { diamonds: -finalPrice } });
        // 將鑽石分配給物品持有人
        const itemHolderUser = await User.findOne({ character_name: itemHolder });
        if (!itemHolderUser) {
            return res.status(404).json({
                code: 404,
                msg: '物品持有人不存在',
                detail: `無法找到物品持有人 ${itemHolder} 的用戶記錄。`,
                suggestion: '請聯繫管理員檢查用戶數據。',
            });
        }
        await User.findByIdAndUpdate(itemHolderUser._id, { $inc: { diamonds: finalPrice } });
        // 發送通知
        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
            const bossKill = auction.itemId;
            if (bossKill && bossKill.dropped_items?.length) {
                itemName = bossKill.dropped_items[0].name || '未知物品';
            }
        }
        const bidderNotification = new Notification({
            userId: highestBidder._id,
            message: `拍賣 ${itemName} (ID: ${id}) 交易已完成，您已支付 ${finalPrice} 鑽石。`,
            auctionId: id,
        });
        const itemHolderNotification = new Notification({
            userId: itemHolderUser._id,
            message: `拍賣 ${itemName} (ID: ${id}) 交易已完成，您已收到 ${finalPrice} 鑽石。`,
            auctionId: id,
        });
        await Notification.insertMany([bidderNotification, itemHolderNotification]);
        // 更新拍賣狀態為已結算
        await Auction.findByIdAndUpdate(id, { status: 'settled' });
        logger.info('Transaction completed and settled successfully', {
            auctionId: id,
            userId: req.user.id,
            highestBidder: highestBidder._id,
            itemHolder,
            finalPrice,
        });
        res.status(200).json({
            code: 200,
            msg: '交易完成，結算成功',
            detail: `用戶 ${highestBidder.character_name} 支付 ${finalPrice} 鑽石，物品持有人 ${itemHolder} 收到 ${finalPrice} 鑽石。`,
        });
    } catch (err) {
        logger.error('Error completing transaction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '交易完成回報失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;