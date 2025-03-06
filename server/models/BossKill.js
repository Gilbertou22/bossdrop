const mongoose = require('mongoose');

const BossKillSchema = new mongoose.Schema({
    boss_name: { type: String, required: true },
    kill_time: { type: Date, required: true },
    dropped_items: [
        {
            _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
            name: { type: String, required: true },
            type: { type: String, enum: ['equipment', 'skill'], required: true },
            apply_deadline: { type: Date, required: true },
        },
    ],
    attendees: {
        type: [String],
        required: true,
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.every(item => typeof item === 'string');
            },
            message: props => `${props.value} 必須是字符串陣列！`,
        },
    },
    screenshots: [{ type: String }],
    final_recipient: { type: String, default: null },
    status: { type: String, enum: ['pending', 'assigned', 'expired'], default: 'pending' }, // 添加 expired 枚舉值
    created_at: { type: Date, default: Date.now },
});

BossKillSchema.pre('save', function (next) {
    if (this.attendees && typeof this.attendees === 'string') {
        try {
            const parsed = JSON.parse(this.attendees);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                this.attendees = parsed;
            } else {
                throw new Error('無法解析 attendees 為有效陣列');
            }
        } catch (e) {
            return next(new Error('attendees 格式錯誤: ' + e.message));
        }
    }
    if (this.dropped_items && Array.isArray(this.dropped_items)) {
        this.dropped_items = this.dropped_items.map(item => ({
            ...item,
            _id: item._id || new mongoose.Types.ObjectId(),
        }));
    }
    next();
});

module.exports = mongoose.model('BossKill', BossKillSchema);