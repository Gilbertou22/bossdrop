const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    mustChangePassword: { type: Boolean, default: false }, // 新增字段，表示是否需更改密碼
    dkpPoints: {
        type: Number,
        default: 0, // 玩家的 DKP 總點數
    },
});

// 密碼加密
UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model('User', UserSchema);