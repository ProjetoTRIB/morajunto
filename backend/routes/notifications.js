const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/notifications — list user notifications
router.get('/', async (req, res) => {
    try {
        var notifications = await Notification.find({ user: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ notifications });
    } catch (e) {
        res.json({ notifications: [] });
    }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
    try {
        var count = await Notification.countDocuments({ user: req.user.userId, read: false });
        res.json({ count });
    } catch (e) {
        res.json({ count: 0 });
    }
});

// POST /api/notifications/read — mark all as read
router.post('/read', async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.userId, read: false },
            { read: true }
        );
        res.json({ message: 'ok' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao marcar notificações' });
    }
});

module.exports = router;
