const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId, // 應為 ObjectId 類型
        required: true,
        ref: 'BossKill', // 可選：參考 BossKill 模型
    },
    startingPrice: {
        type: Number,
        required: true,
    },
    currentPrice: {
        type: Number,
        required: true,
    },
    buyoutPrice: {
        type: Number,
        default: null, // 可選字段，默認為 null 表示無直接得標價
    },
    endTime: {
        type: Date,
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    highestBidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null, // 初始為 null
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'completed', 'cancelled'], // 限制狀態值
        default: 'active', // 默認為 active
    },
});

module.exports = mongoose.model('Auction', AuctionSchema);