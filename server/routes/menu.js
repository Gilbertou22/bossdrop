const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const MenuLog = require('../models/MenuLog');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');
const mongoose = require('mongoose');

// 獲取所有菜單項
router.get('/', auth, async (req, res) => {
    try {
        const menuItems = await MenuItem.find()
            .populate('children')
            .sort({ order: 1 });
        res.json(menuItems);
    } catch (err) {
        logger.error('Get menu items error', { error: err.message });
        res.status(500).json({ msg: '服務器錯誤', detail: err.message });
    }
});

// 創建新菜單項（管理員專用）
router.post('/', auth, adminOnly, async (req, res) => {
    const { key, label, icon, roles, children, order } = req.body;
    try {
        let parsedRoles = [];
        if (roles) {
            parsedRoles = Array.isArray(roles) ? roles : JSON.parse(roles);
        }

        let parsedChildren = [];
        if (children) {
            parsedChildren = Array.isArray(children) ? children : JSON.parse(children);
            parsedChildren = parsedChildren
                .map(child => {
                    if (typeof child !== 'string') {
                        logger.warn('Invalid child type, expected string', { child });
                        return null;
                    }
                    if (!mongoose.Types.ObjectId.isValid(child)) {
                        throw new Error(`Invalid ObjectId: ${child}`);
                    }
                    return new mongoose.Types.ObjectId(child);
                })
                .filter(child => child); // 過濾掉無效值
        }

        const menuItem = new MenuItem({
            key,
            label,
            icon,
            roles: parsedRoles,
            children: parsedChildren,
            order,
            customIcon: req.file ? `/uploads/icons/${req.file.filename}` : undefined,
        });
        await menuItem.save();

        await MenuLog.create({
            action: 'create',
            menuItemId: menuItem._id,
            userId: req.user.id,
            details: { ...req.body, customIcon: menuItem.customIcon },
        });

        res.status(201).json({ msg: '菜單項創建成功', menuItem });
    } catch (err) {
        logger.error('Create menu item error', { error: err.message });
        res.status(500).json({ msg: '創建失敗', detail: err.message });
    }
});

// 更新菜單項（管理員專用）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { key, label, icon, roles, children, order } = req.body;
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ msg: '菜單項不存在' });
        }

        let parsedRoles = [];
        if (roles) {
            parsedRoles = Array.isArray(roles) ? roles : JSON.parse(roles);
        }

        let parsedChildren = [];
        if (children) {
            parsedChildren = Array.isArray(children) ? children : JSON.parse(children);
            parsedChildren = parsedChildren
                .map(child => {
                    if (typeof child !== 'string') {
                        logger.warn('Invalid child type, expected string', { child });
                        return null;
                    }
                    if (!mongoose.Types.ObjectId.isValid(child)) {
                        throw new Error(`Invalid ObjectId: ${child}`);
                    }
                    return new mongoose.Types.ObjectId(child);
                })
                .filter(child => child); // 過濾掉無效值
        }

        menuItem.key = key || menuItem.key;
        menuItem.label = label || menuItem.label;
        menuItem.icon = icon || menuItem.icon;
        menuItem.roles = parsedRoles || menuItem.roles;
        menuItem.children = parsedChildren || menuItem.children;
        menuItem.order = order !== undefined ? order : menuItem.order;
        menuItem.customIcon = req.file ? `/uploads/icons/${req.file.filename}` : (icon ? undefined : menuItem.customIcon);
        menuItem.updatedAt = Date.now();
        await menuItem.save();

        await MenuLog.create({
            action: 'update',
            menuItemId: menuItem._id,
            userId: req.user.id,
            details: { ...req.body, customIcon: menuItem.customIcon },
        });

        res.json({ msg: '菜單項更新成功', menuItem });
    } catch (err) {
        logger.error('Update menu item error', { error: err.message });
        res.status(500).json({ msg: '更新失敗', detail: err.message });
    }
});

// 刪除菜單項（管理員專用）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const menuItem = await MenuItem.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ msg: '菜單項不存在' });
        }

        await MenuLog.create({
            action: 'delete',
            menuItemId: menuItem._id,
            userId: req.user.id,
            details: menuItem.toObject(),
        });

        await MenuItem.deleteOne({ _id: req.params.id });
        await MenuItem.updateMany(
            { children: req.params.id },
            { $pull: { children: req.params.id } }
        );
        res.json({ msg: '菜單項刪除成功' });
    } catch (err) {
        logger.error('Delete menu item error', { error: err.message });
        res.status(500).json({ msg: '刪除失敗', detail: err.message });
    }
});

// 批量刪除（管理員專用）
router.delete('/batch', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ msg: '請提供有效的菜單項 ID 陣列' });
    }
    try {
        const menuItems = await MenuItem.find({ _id: { $in: ids } });
        await Promise.all(menuItems.map(item =>
            MenuLog.create({
                action: 'delete',
                menuItemId: item._id,
                userId: req.user.id,
                details: item.toObject(),
            })
        ));

        await MenuItem.deleteMany({ _id: { $in: ids } });
        await MenuItem.updateMany(
            { children: { $in: ids } },
            { $pull: { children: { $in: ids } } }
        );
        res.json({ msg: '批量刪除成功', deletedCount: ids.length });
    } catch (err) {
        logger.error('Batch delete menu items error', { error: err.message });
        res.status(500).json({ msg: '批量刪除失敗', detail: err.message });
    }
});

module.exports = router;