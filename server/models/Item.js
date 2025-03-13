const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['equipment', 'skill'], required: true }, // 添加 type 字段
    description: { type: String }, // 添加 description 字段
    imageUrl: { type: String }, // 添加 imageUrl 字段
    status: { type: String, enum: ['pending', 'approved', 'expired'], default: 'pending' },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    endTime: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Item', itemSchema);