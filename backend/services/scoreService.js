const User = require('../models/User');

/**
 * Update payment score when a payment is confirmed.
 * Called from payments.js webhook/confirm/status endpoints.
 */
async function updatePaymentScore(tx) {
    if (!tx || !tx.tenant || tx.status !== 'paid') return;

    try {
        var user = await User.findById(tx.tenant);
        if (!user) return;

        var ps = user.paymentScore || { totalOnTime: 0, totalLate: 0, totalMissed: 0, score: 0, badge: 'none', streakMonths: 0 };

        // Check if paid on time (before or on due date)
        var isOnTime = true;
        if (tx.dueDate && tx.paidAt) {
            // Add 1 day grace to due date (pay by end of due day)
            var deadline = new Date(tx.dueDate);
            deadline.setDate(deadline.getDate() + 1);
            isOnTime = tx.paidAt <= deadline;
        }

        if (isOnTime) {
            ps.totalOnTime = (ps.totalOnTime || 0) + 1;
            ps.streakMonths = (ps.streakMonths || 0) + 1;
        } else {
            ps.totalLate = (ps.totalLate || 0) + 1;
            ps.streakMonths = 0;
        }

        // Calculate score (0-100)
        var total = ps.totalOnTime + ps.totalLate + ps.totalMissed;
        ps.score = total > 0 ? Math.round((ps.totalOnTime / total) * 100) : 0;

        // Determine badge
        if (ps.streakMonths >= 6) ps.badge = 'ouro';
        else if (ps.streakMonths >= 3) ps.badge = 'prata';
        else if (ps.streakMonths >= 1) ps.badge = 'bronze';
        else ps.badge = 'none';

        user.paymentScore = ps;
        await user.save();
    } catch (e) {
        console.error('Score update error:', e.message);
    }
}

module.exports = { updatePaymentScore };
