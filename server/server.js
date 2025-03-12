const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const startAuctionCron = require('./utils/auctionCron');
const startItemExpirationCron = require('./utils/itemExpirationCron'); // 新增
const cors = require('cors');
const app = express();

connectDB();

// 配置靜態文件服務
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'x-auth-token'] }));
app.use(express.json());

console.log('Loading routes...');
app.use('/api/users', require('./routes/users'));
console.log('Users route loaded');
app.use('/api/boss-kills', require('./routes/bossKills'));
console.log('BossKills route loaded');
app.use('/api/auth', require('./routes/auth'));
console.log('Auth route loaded');
app.use('/api/applications', require('./routes/applications'));
console.log('Applications route loaded');
app.use('/api/auctions', require('./routes/auctions'));
console.log('Auctions route loaded');
app.use('/api/stats', require('./routes/stats'));
console.log('Stats route loaded');
app.use('/api/bosses', require('./routes/bosses'));
console.log('Bosses route loaded');
app.use('/api/items', require('./routes/items'));
console.log('Items route loaded');
app.use('/api/pending', require('./routes/pending')); // 新增路由
console.log('Pending route loaded');
app.use('/api/notifications', require('./routes/notifications')); // 新增路由
console.log('notifications route loaded');
app.use('/api/alerts', require('./routes/alerts')); // 新增路由
console.log('Alerts route loaded');

try {
    startAuctionCron();
    console.log('Auction cron started');
    startItemExpirationCron();
    console.log('Item expiration cron started');
} catch (err) {
    console.error('Error starting cron jobs:', err);
}


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} at ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`));