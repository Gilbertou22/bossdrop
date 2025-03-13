const mongoose = require('mongoose');

const BossSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Boss', BossSchema);