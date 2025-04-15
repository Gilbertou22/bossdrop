const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const MenuItem = require('../models/MenuItem');
const logger = require('../logger');

router.get('/menu', auth, async (req, res) => {
    try {
        console.log('Session data:', req.session);
        // Ensure req.session exists before accessing menuItems
        let menuItems = req.session && req.session.menuItems ? req.session.menuItems : [];
        if (menuItems.length === 0) {
            menuItems = await MenuItem.find()
                .populate({
                    path: 'children',
                    populate: { path: 'children' },
                })
                .sort({ order: 1 });

            const filterMenuItems = (items, userRole) => {
                return items
                    .filter(item => {
                        let roles;
                        try {
                            roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
                            while (typeof roles === 'string') {
                                roles = JSON.parse(roles);
                            }
                        } catch (err) {
                            logger.warn('Failed to parse roles', { roles: item.roles, error: err.message });
                            roles = [];
                        }
                        return roles.includes(userRole);
                    })
                    .map(item => {
                        const filteredItem = {
                            key: item.key,
                            label: item.label,
                            icon: item.icon,
                            customIcon: item.customIcon,
                            roles: item.roles,
                            parentId: item.parentId,
                            order: item.order,
                            _id: item._id,
                        };
                        if (item.children && item.children.length > 0) {
                            filteredItem.children = filterMenuItems(item.children, userRole);
                        }
                        return filteredItem;
                    })
                    .filter(item => item.children ? item.children.length > 0 : true);
            };

            menuItems = filterMenuItems(menuItems, req.user.role);
            // Only set req.session.menuItems if req.session exists
            if (req.session) {
                req.session.menuItems = menuItems;
                logger.info('Reloaded menu items into session', { userId: req.user.id, menuItems });
            } else {
                logger.warn('Cannot store menu items, req.session is undefined');
            }
        }
        logger.info('Fetched menu items from session', { userId: req.user.id, menuItems });
        res.json(menuItems);
    } catch (err) {
        logger.error('Get session menu error', { error: err.message });
        res.status(500).json({ msg: '服務器錯誤', detail: err.message });
    }
});

module.exports = router;