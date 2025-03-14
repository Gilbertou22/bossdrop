const express = require('express');
const router = express.Router();
const AttendeeRequest = require('../models/AttendeeRequest');
const { auth } = require('../middleware/auth');
const BossKill = require('../models/BossKill');

// 提交補單申請
router.post('/', auth, async (req, res) => {
    const { kill_id, proof_image, reason } = req.body;
    const user = req.user;

    try {
        if (!kill_id) {
            return res.status(400).json({ msg: '缺少擊殺記錄 ID' });
        }

        const kill = await BossKill.findById(kill_id);
        if (!kill) {
            return res.status(404).json({ msg: '擊殺記錄不存在' });
        }

        if (kill.status !== 'pending') {
            return res.status(400).json({ msg: '該擊殺記錄已過補單期限' });
        }

        if (kill.attendees.includes(user.character_name)) {
            return res.status(400).json({ msg: '您已在參與者列表中，無需補單' });
        }

        const request = new AttendeeRequest({
            user_id: user.id,
            kill_id,
            character_name: user.character_name,
            proof_image,
            reason,
            status: 'pending',
        });

        await request.save();
        res.status(201).json({ msg: '補單申請提交成功，等待管理員審核', request });
    } catch (err) {
        console.error('Submit attendee request error:', err);
        res.status(500).json({ msg: '提交補單申請失敗', error: err.message });
    }
});

module.exports = router;