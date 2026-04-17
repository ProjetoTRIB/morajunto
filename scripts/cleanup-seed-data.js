// ===== MoraJunto — Limpeza de dados seed/beta =====
// Uso:
//   node scripts/cleanup-seed-data.js             → DRY RUN (só mostra o que seria apagado)
//   node scripts/cleanup-seed-data.js --execute   → EXECUTA (apaga de verdade)
//
// Critérios de identificação como "seed/beta":
//   - User.email termina com @teste.com
//   - User.email em lista conhecida de seeds (marcos/ana/roberto/patricia/fernando .prop@teste.com)
//   - User.email começa com test / fake / seed / mock (case-insensitive)
//   - Property órfã (agency/owner aponta para user já marcado como seed)
//
// Preserva:
//   - Admin: ADMIN_EMAIL do .env (default thalis132008@gmail.com)
//   - Qualquer user com role=admin
//
// Cascata: deletar users → deletar properties/rentals/notifications/conversations/paymentTransactions associadas

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../backend/models/User');
const Property = require('../backend/models/Property');
const Rental = require('../backend/models/Rental');
const PaymentTransaction = require('../backend/models/PaymentTransaction');
const Notification = require('../backend/models/Notification');

const EXECUTE = process.argv.includes('--execute');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'thalis132008@gmail.com').toLowerCase();

// Padrões de email considerados seed/beta
const SEED_EMAIL_PATTERNS = [
    /@teste\.com$/i,
    /^test[0-9_.-]*@/i,
    /^fake[0-9_.-]*@/i,
    /^seed[0-9_.-]*@/i,
    /^mock[0-9_.-]*@/i,
    /^example[0-9_.-]*@/i
];

function isSeedEmail(email) {
    if (!email) return false;
    var e = email.toLowerCase();
    if (e === ADMIN_EMAIL) return false;
    return SEED_EMAIL_PATTERNS.some(function(rx) { return rx.test(e); });
}

async function main() {
    console.log('=== MoraJunto Cleanup ===');
    console.log('Mode:', EXECUTE ? '🔥 EXECUTE (vai apagar)' : '👀 DRY RUN (só mostra)');
    console.log('Admin preservado:', ADMIN_EMAIL);
    console.log('');

    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI não configurada');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao Mongo\n');

    // 1. Identificar users seed
    var allUsers = await User.find({}).select('_id email name role').lean();
    var seedUsers = allUsers.filter(function(u) {
        if (u.role === 'admin') return false;
        if (u.email && u.email.toLowerCase() === ADMIN_EMAIL) return false;
        return isSeedEmail(u.email);
    });
    var seedUserIds = seedUsers.map(function(u) { return u._id; });

    console.log('👤 Users seed identificados: ' + seedUsers.length);
    seedUsers.forEach(function(u) {
        console.log('   - ' + u.email + ' (' + u.name + ', role=' + u.role + ')');
    });
    console.log('');

    // 2. Identificar properties dos users seed
    var seedProperties = await Property.find({
        $or: [
            { agency: { $in: seedUserIds } },
            { owner: { $in: seedUserIds } }
        ]
    }).select('_id title neighborhood price').lean();
    var seedPropertyIds = seedProperties.map(function(p) { return p._id; });

    console.log('🏠 Properties de users seed: ' + seedProperties.length);
    seedProperties.slice(0, 5).forEach(function(p) {
        console.log('   - "' + p.title + '" — ' + p.neighborhood + ' R$' + p.price);
    });
    if (seedProperties.length > 5) console.log('   ... (+' + (seedProperties.length - 5) + ' outros)');
    console.log('');

    // 3. Rentals associados
    var seedRentals = await Rental.find({
        $or: [
            { owner: { $in: seedUserIds } },
            { tenants: { $in: seedUserIds } },
            { property: { $in: seedPropertyIds } }
        ]
    }).select('_id').lean();
    var seedRentalIds = seedRentals.map(function(r) { return r._id; });
    console.log('📝 Rentals associados: ' + seedRentals.length);

    // 4. PaymentTransactions associadas
    var seedTxCount = await PaymentTransaction.countDocuments({
        $or: [
            { tenant: { $in: seedUserIds } },
            { owner: { $in: seedUserIds } },
            { rental: { $in: seedRentalIds } }
        ]
    });
    console.log('💰 PaymentTransactions associadas: ' + seedTxCount);

    // 5. Notifications
    var seedNotifCount = await Notification.countDocuments({ user: { $in: seedUserIds } });
    console.log('🔔 Notifications associadas: ' + seedNotifCount);

    console.log('');
    console.log('=== RESUMO ===');
    console.log('  Users:        ' + seedUsers.length);
    console.log('  Properties:   ' + seedProperties.length);
    console.log('  Rentals:      ' + seedRentals.length);
    console.log('  PaymentTxs:   ' + seedTxCount);
    console.log('  Notifications:' + seedNotifCount);
    console.log('');

    if (!EXECUTE) {
        console.log('👀 DRY RUN — nada foi apagado. Rode com --execute para apagar.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // EXECUTE
    console.log('🔥 Apagando em 3s... (Ctrl+C pra cancelar)');
    await new Promise(function(r) { setTimeout(r, 3000); });

    var nDel = { users: 0, properties: 0, rentals: 0, txs: 0, notifs: 0 };

    if (seedNotifCount > 0) {
        var rN = await Notification.deleteMany({ user: { $in: seedUserIds } });
        nDel.notifs = rN.deletedCount;
    }
    if (seedTxCount > 0) {
        var rT = await PaymentTransaction.deleteMany({
            $or: [
                { tenant: { $in: seedUserIds } },
                { owner: { $in: seedUserIds } },
                { rental: { $in: seedRentalIds } }
            ]
        });
        nDel.txs = rT.deletedCount;
    }
    if (seedRentalIds.length > 0) {
        var rR = await Rental.deleteMany({ _id: { $in: seedRentalIds } });
        nDel.rentals = rR.deletedCount;
    }
    if (seedPropertyIds.length > 0) {
        var rP = await Property.deleteMany({ _id: { $in: seedPropertyIds } });
        nDel.properties = rP.deletedCount;
    }
    if (seedUserIds.length > 0) {
        var rU = await User.deleteMany({ _id: { $in: seedUserIds } });
        nDel.users = rU.deletedCount;
    }

    console.log('');
    console.log('✅ Apagados:');
    console.log('   Users:         ' + nDel.users);
    console.log('   Properties:    ' + nDel.properties);
    console.log('   Rentals:       ' + nDel.rentals);
    console.log('   PaymentTxs:    ' + nDel.txs);
    console.log('   Notifications: ' + nDel.notifs);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(function(e) {
    console.error('❌ Erro:', e.message);
    console.error(e.stack);
    process.exit(1);
});
