const express = require('express');
const session = require('express-session');
const connectDB = require('./config/db');
const path = require('path');
const startAuctionCron = require('./utils/auctionCron');
const startItemExpirationCron = require('./utils/itemExpirationCron'); // 新增
const cors = require('cors');
const multer = require('multer');
const app = express();

connectDB();

// 配置 multer 存儲
const storage = multer.diskStorage({
    destination: './uploads/icons/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 }, // 限制 1MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('僅支持圖片文件！'), false);
        }
    },
});

// 確保 uploads/icons 目錄存在
const fs = require('fs');
if (!fs.existsSync('./uploads/icons')) {
    fs.mkdirSync('./uploads/icons', { recursive: true });
}

// 配置靜態文件服務
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'x-auth-token'] }));


// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'https://103.195.4.189', 'https://www.gnmr.net'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token'],
    credentials: true,
}));

// 設置 session
app.use(session({
    secret: 'bfksfysa7e32kdhayu292sz', // 替換為安全的密鑰
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, //process.env.NODE_ENV === 'production', // 生產環境使用 HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // session 有效期 24 小時
    },
}));

// 檢查 session 中間件
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session data before request:', req.session);
    next();
});

// 處理 OPTIONS 預檢請求
app.options('*', cors());

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
app.use('/api/guilds', require('./routes/guilds')); // 新增路由
console.log('Guilds route loaded');
app.use('/api/attendee-requests', require('./routes/attendeerequests'));
console.log('AttendeeRequests route loaded');
app.use('/api/logs', require('./routes/logs'));
console.log('Logs route loaded');
app.use('/api/wallet', require('./routes/wallet'));
console.log('Wallet route loaded');
app.use('/api/dkp', require('./routes/dkp'));
console.log('DKP route loaded');
app.use('/api/item-levels', require('./routes/item-levels'));
console.log('ItemLevels route loaded');
const menuRoutes = require('./routes/menu');
app.use('/api/menu', upload.single('customIcon'), menuRoutes); // 添加 upload 中間件
console.log('Menu route loaded');
app.use('/api/session', require('./routes/session'));
console.log('Session route loaded');

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