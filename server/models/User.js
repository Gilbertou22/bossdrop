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
    role: { type: String, enum: ['user', 'moderator', 'admin', 'guild'], default: 'user' },
    password: { type: String, required: true },
    guildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null },
    mustChangePassword: { type: Boolean, default: false },
    dkpPoints: { type: Number, default: 0 },
    // 新增 profession 字段，引用 Profession 模型
    profession: { type: mongoose.Schema.Types.ObjectId, ref: 'Profession', default: null },
});

// 在保存用戶前哈希密碼
UserSchema.pre('save', async function (next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        next();
    } catch (err) {
        console.error('Error in pre-save hook:', err);
        next(err);
    }
});

module.exports = mongoose.model('User', UserSchema);