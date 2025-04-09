const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // 確保使用 bcryptjs

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
    guildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null }, // 添加旅團 ID
    mustChangePassword: { type: Boolean, default: false }, // 新增字段，表示是否需更改密碼
    dkpPoints: {
        type: Number,
        default: 0, // 玩家的 DKP 總點數
    },
});

// 在保存用戶前哈希密碼
UserSchema.pre('save', async function (next) {
    try {
        console.log('Pre-save hook triggered for user:', this.character_name);
        console.log('Password modified:', this.isModified('password'));
        console.log('Password before hash:', this.password);
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
            console.log('Hashed password in pre-save:', this.password);
        }
        next();
    } catch (err) {
        console.error('Error in pre-save hook:', err);
        next(err);
    }
});

module.exports = mongoose.model('User', UserSchema);