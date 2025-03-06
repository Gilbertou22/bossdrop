const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    world_name: { type: String, required: true },
    character_name: { type: String, required: true, unique: true },
    discord_id: { type: String, default: null },
    raid_level: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
    screenshot: { type: String, default: null },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' }, // 擴展角色
    password: { type: String, required: true },
});

module.exports = mongoose.model('User', UserSchema);