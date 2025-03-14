const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    world_name: { type: String, required: true },
    character_name: { type: String, required: true, unique: true },
    discord_id: { type: String, default: null },
    raid_level: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
    screenshot: { type: String, default: null },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    password: { type: String, required: true },
    guildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null }, // 添加旅團 ID
});

module.exports = mongoose.model('User', UserSchema);