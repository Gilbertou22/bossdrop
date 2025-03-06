const mongoose = require('mongoose');

const BossSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // 首領名稱，唯一
    description: { type: String }, // 可選描述
});

module.exports = mongoose.model('Boss', BossSchema);