const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const logger = require('../logger');

// 獲取 session 中的菜單數據
router.get('/menu', auth, (req, res) => {
    try {
        console.log('Session data:', req.session); // 檢查 session 數據
        const menuItems = req.session.menuItems || [];
        logger.info('Fetched menu items from session', { userId: req.user.id, menuItems });
        res.json(menuItems);
    } catch (err) {
        logger.error('Get session menu error', { error: err.message });
        res.status(500).json({ msg: '服務器錯誤', detail: err.message });
    }
});

module.exports = router;