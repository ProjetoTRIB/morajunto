const PaymentTransaction = require('../models/PaymentTransaction');
const Notification = require('../models/Notification');
const Rental = require('../models/Rental');

/**
 * Run daily reminders for pending payments.
 * Called by cron job in server.js daily at 9:00 AM Brasilia.
 */
async function runDailyReminders(io, onlineUsers) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var currentMonth = today.toISOString().substring(0, 7);

    var pendingTxs = await PaymentTransaction.find({
        status: 'pending',
        month: currentMonth,
        dueDate: { $exists: true }
    }).populate('tenant', 'name').populate('property', 'title');

    var created = 0;

    for (var tx of pendingTxs) {
        if (!tx.dueDate || !tx.tenant) continue;

        var dueDate = new Date(tx.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        var diffMs = dueDate.getTime() - today.getTime();
        var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        var propTitle = tx.property ? tx.property.title : 'seu imóvel';
        var amount = 'R$' + (tx.totalAmount || 0).toFixed(2);

        // Prevent duplicate notifications (check if already sent today for this tx+type)
        async function shouldNotify(userId, type, txId) {
            var startOfDay = new Date(today);
            var endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            var existing = await Notification.findOne({
                user: userId,
                type: type,
                'metadata.paymentTransactionId': txId,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });
            return !existing;
        }

        // 1 day before due date
        if (diffDays === 1) {
            if (await shouldNotify(tx.tenant._id, 'payment_reminder', tx._id)) {
                await createAndEmit(tx.tenant._id, 'payment_reminder',
                    'Aluguel vence amanhã',
                    'Seu aluguel de ' + amount + ' (' + propTitle + ') vence amanhã, dia ' + dueDate.getDate() + '.',
                    tx, io, onlineUsers);
                created++;
            }
        }

        // Due today
        if (diffDays === 0) {
            if (await shouldNotify(tx.tenant._id, 'payment_due', tx._id)) {
                await createAndEmit(tx.tenant._id, 'payment_due',
                    'Aluguel vence hoje!',
                    'Seu aluguel de ' + amount + ' (' + propTitle + ') vence hoje. Pague pelo app para manter seu score.',
                    tx, io, onlineUsers);
                created++;
            }
        }

        // 3 days late
        if (diffDays === -3) {
            if (await shouldNotify(tx.tenant._id, 'payment_late', tx._id)) {
                await createAndEmit(tx.tenant._id, 'payment_late',
                    'Pagamento em atraso!',
                    'Seu aluguel de ' + amount + ' (' + propTitle + ') está 3 dias atrasado.',
                    tx, io, onlineUsers);
                created++;

                // Notify owner
                await createAndEmit(tx.owner, 'roommate_late',
                    'Inquilino em atraso',
                    tx.tenantName + ' está 3 dias atrasado(a) no pagamento de ' + tx.month + '.',
                    tx, io, onlineUsers);

                // Notify other roommates
                var rental = await Rental.findById(tx.rental);
                if (rental) {
                    for (var tid of rental.tenants) {
                        if (tid.toString() !== tx.tenant._id.toString()) {
                            await createAndEmit(tid, 'roommate_late',
                                'Roommate atrasado',
                                tx.tenantName + ' está com o pagamento de ' + tx.month + ' em atraso.',
                                tx, io, onlineUsers);
                        }
                    }
                }
            }
        }

        // 7 days late - second alert
        if (diffDays === -7) {
            if (await shouldNotify(tx.tenant._id, 'payment_late', tx._id)) {
                await createAndEmit(tx.tenant._id, 'payment_late',
                    'Pagamento 7 dias atrasado!',
                    'Seu aluguel de ' + amount + ' (' + propTitle + ') está 7 dias atrasado. Regularize para manter seu score de bom pagador.',
                    tx, io, onlineUsers);
                created++;
            }
        }
    }

    if (created > 0) {
        console.log('📩 Reminders: ' + created + ' notificações enviadas');
    }
}

async function createAndEmit(userId, type, title, message, tx, io, onlineUsers) {
    var notif = await Notification.create({
        user: userId,
        type: type,
        title: title,
        message: message,
        metadata: {
            paymentTransactionId: tx._id,
            rentalId: tx.rental,
            month: tx.month
        }
    });

    // Real-time push via Socket.io
    if (io && onlineUsers) {
        var socketId = onlineUsers.get(userId.toString());
        if (socketId) {
            io.to(socketId).emit('notification', {
                _id: notif._id,
                type: type,
                title: title,
                message: message,
                createdAt: notif.createdAt
            });
        }
    }
}

module.exports = { runDailyReminders };
