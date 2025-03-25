const express = require('express');
const router = express.Router();
const BossDKPSetting = require('../models/BossDKPSetting');
const Boss = require('../models/Boss');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取所有 DKP 設定（包含 Boss 信息）
router.get('/', auth, async (req, res) => {
    try {
        const settings = await BossDKPSetting.find()
            .populate('bossId', 'name description difficulty') // 關聯查詢 Boss 表
            .lean();

        res.json(settings);
    } catch (err) {
        console.error('Error fetching DKP settings:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.post('/bulk', auth, adminOnly, async (req, res) => {
    const settings = req.body; // 格式：[{ bossId, dkpPoints }, ...]
    try {
        const results = await Promise.all(settings.map(async ({ bossId, dkpPoints }) => {
            const boss = await Boss.findById(bossId);
            if (!boss) throw new Error(`Boss ${bossId} not found`);
            let setting = await BossDKPSetting.findOne({ bossId });
            if (setting) {
                setting.dkpPoints = dkpPoints;
                setting.updatedAt = Date.now();
            } else {
                setting = new BossDKPSetting({ bossId, dkpPoints });
            }
            await setting.save();
            return setting;
        }));
        res.status(201).json({ msg: '批量保存 DKP 設定成功', results });
    } catch (err) {
        res.status(500).json({ msg: '批量保存 DKP 設定失敗', error: err.message });
    }
});

// 獲取單個 DKP 設定（根據 bossId）
router.get('/:bossId', auth, async (req, res) => {
    try {
        const setting = await BossDKPSetting.findOne({ bossId: req.params.bossId })
            .populate('bossId', 'name description difficulty')
            .lean();

        if (!setting) {
            return res.status(404).json({
                code: 404,
                msg: 'DKP 設定不存在',
                suggestion: '請檢查 bossId 或聯繫管理員',
            });
        }

        res.json(setting);
    } catch (err) {
        console.error('Error fetching DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 創建或更新 DKP 設定（管理員專用）
router.post('/', auth, adminOnly, async (req, res) => {
    const { bossId, dkpPoints } = req.body;

    try {
        // 驗證輸入
        if (!bossId || typeof dkpPoints !== 'number' || dkpPoints < 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的 bossId 和 dkpPoints（非負數）',
                suggestion: '檢查輸入數據格式',
            });
        }

        // 確認 bossId 存在
        const boss = await Boss.findById(bossId);
        if (!boss) {
            return res.status(404).json({
                code: 404,
                msg: 'Boss 不存在',
                suggestion: '請檢查 bossId 是否正確',
            });
        }

        // 檢查是否已存在設定
        let setting = await BossDKPSetting.findOne({ bossId });
        if (setting) {
            // 更新現有設定
            setting.dkpPoints = dkpPoints;
            setting.updatedAt = Date.now();
        } else {
            // 創建新設定
            setting = new BossDKPSetting({ bossId, dkpPoints });
        }

        await setting.save();
        const populatedSetting = await BossDKPSetting.findById(setting._id)
            .populate('bossId', 'name description difficulty')
            .lean();

        res.status(201).json({
            msg: setting.isNew ? 'DKP 設定創建成功' : 'DKP 設定更新成功',
            setting: populatedSetting,
        });
    } catch (err) {
        console.error('Error saving DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '保存 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 更新 DKP 設定（管理員專用）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { dkpPoints } = req.body;

    try {
        if (typeof dkpPoints !== 'number' || dkpPoints < 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的 dkpPoints（非負數）',
                suggestion: '檢查輸入數據格式',
            });
        }

        const setting = await BossDKPSetting.findById(req.params.id);
        if (!setting) {
            return res.status(404).json({
                code: 404,
                msg: 'DKP 設定不存在',
                suggestion: '請檢查 ID 或聯繫管理員',
            });
        }

        setting.dkpPoints = dkpPoints;
        setting.updatedAt = Date.now();
        await setting.save();

        const populatedSetting = await BossDKPSetting.findById(setting._id)
            .populate('bossId', 'name description difficulty')
            .lean();

        res.json({
            msg: 'DKP 設定更新成功',
            setting: populatedSetting,
        });
    } catch (err) {
        console.error('Error updating DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '更新 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 刪除 DKP 設定（管理員專用）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const setting = await BossDKPSetting.findById(req.params.id);
        if (!setting) {
            return res.status(404).json({
                code: 404,
                msg: 'DKP 設定不存在',
                suggestion: '請檢查 ID 或聯繫管理員',
            });
        }

        await setting.remove();
        res.json({ msg: 'DKP 設定刪除成功' });
    } catch (err) {
        console.error('Error deleting DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '刪除 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;