const express = require('express');
const router = express.Router();
const Boss = require('../models/Boss');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取所有首領
router.get('/', async (req, res) => {
    try {
        const bosses = await Boss.find();
        res.json(bosses);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 創建首領（管理員）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, description } = req.body;
    try {
        const boss = new Boss({ name, description });
        await boss.save();
        res.status(201).json(boss);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新首領（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, description } = req.body;
    try {
        const boss = await Boss.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true, runValidators: true }
        );
        if (!boss) return res.status(404).json({ msg: '首領不存在' });
        res.json(boss);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 刪除首領（管理員）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const boss = await Boss.findByIdAndDelete(req.params.id);
        if (!boss) return res.status(404).json({ msg: '首領不存在' });
        res.json({ msg: '首領已刪除' });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

module.exports = router;