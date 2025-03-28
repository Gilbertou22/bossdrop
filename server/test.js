// 腳本：為現有 BossKill 記錄添加 auction_status 字段
const mongoose = require('mongoose');
const BossKill = require('./models/BossKill');
const Boss = require('./models/Boss');
const ItemLevel = require('./models/ItemLevel');

mongoose.connect('mongodb://localhost:27017/boss_tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});



const checkItemLevel = async () => {
    const itemLevel = await BossKill.find({ auction_status: 'pending' })
        .populate('bossId', 'name')
        .populate('dropped_items.level', 'color')
        .lean();
    console.log('ItemLevel for 67d3e127a21a9b8dc9ced578:', itemLevel.dropped_items);
};

checkItemLevel();