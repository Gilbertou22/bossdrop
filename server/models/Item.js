const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'expired'], default: 'pending' },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // 申請人
    endTime: { type: Date }, // 截止時間
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // 管理員批准
    // 其他字段...
});

module.exports = mongoose.model('Item', itemSchema);