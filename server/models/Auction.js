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
});

module.exports = mongoose.model('Auction', AuctionSchema);