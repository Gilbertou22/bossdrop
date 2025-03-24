const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'BossKill',
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
        default: null,
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
        default: null,
    },
    itemHolder: {
        type: String,
        required: true, // 確保物品持有人字段必須存在
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'completed', 'cancelled', 'settled'],
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Auction', AuctionSchema);