const express = require('express');
const router = express.Router();
const Boss = require('../models/Boss');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取所有首領（支持搜索和過濾）
router.get('/', async (req, res) => {
    try {
        const { search, difficulty } = req.query;
        let query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }
        if (difficulty && difficulty !== 'all') query.difficulty = difficulty;
        const bosses = await Boss.find(query).lean();
        res.json(bosses);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 創建首領（管理員）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, description, difficulty } = req.body;
    try {
        const existingBoss = await Boss.findOne({ name });
        if (existingBoss) {
            return res.status(400).json({ msg: '首領名稱已存在，請使用其他名稱' });
        }
        const boss = new Boss({ name, description, difficulty });
        await boss.save();
        res.status(201).json(boss);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新首領（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, description, difficulty } = req.body;
    try {
        const existingBoss = await Boss.findOne({ name, _id: { $ne: req.params.id } });
        if (existingBoss) {
            return res.status(400).json({ msg: '首領名稱已存在，請使用其他名稱' });
        }
        const boss = await Boss.findByIdAndUpdate(
            req.params.id,
            { name, description, difficulty },
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

// 批量刪除首領（管理員）
router.delete('/batch-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: '請提供有效的首領 ID 列表' });
        }
        const result = await Boss.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ msg: '沒有找到任何首領進行刪除' });
        }
        res.json({ msg: `成功刪除 ${result.deletedCount} 個首領` });
    } catch (err) {
        res.status(500).json({ msg: '批量刪除失敗', error: err.message });
    }
});

module.exports = router;