const User = require('../models/User');
const Property = require('../models/Property');
const Rental = require('../models/Rental');
const AgentCommission = require('../models/AgentCommission');

const TIERS = [
    { name: 'elite',     label: 'Elite',     listings: 25, rentals: 15, rate: 0.40 },
    { name: 'premium',   label: 'Premium',   listings: 15, rentals: 8,  rate: 0.35 },
    { name: 'destaque',  label: 'Destaque',  listings: 8,  rentals: 3,  rate: 0.30 },
    { name: 'corretor',  label: 'Corretor',  listings: 3,  rentals: 1,  rate: 0.20 },
    { name: 'iniciante', label: 'Iniciante', listings: 0,  rentals: 0,  rate: 0.10 },
];

function calculateTier(activeListings, totalRentals) {
    for (var t of TIERS) {
        if (activeListings >= t.listings && totalRentals >= t.rentals) return t;
    }
    return TIERS[TIERS.length - 1];
}

function getTierByName(name) {
    return TIERS.find(t => t.name === name) || TIERS[TIERS.length - 1];
}

function getNextTier(currentTierName) {
    var idx = TIERS.findIndex(t => t.name === currentTierName);
    if (idx <= 0) return null; // already elite or not found
    return TIERS[idx - 1];
}

async function recalcAgentTier(userId) {
    var activeListings = await Property.countDocuments({ agency: userId, status: 'active' });
    var agentPropertyIds = await Property.find({ agency: userId }).distinct('_id');
    var totalRentals = agentPropertyIds.length > 0
        ? await Rental.countDocuments({ property: { $in: agentPropertyIds }, status: 'active' })
        : 0;
    var tier = calculateTier(activeListings, totalRentals);
    await User.findByIdAndUpdate(userId, {
        'agentProfile.tier': tier.name,
        'agentProfile.activeListings': activeListings,
        'agentProfile.totalRentals': totalRentals
    });
    return tier;
}

async function creditAgentCommission(tx) {
    if (!tx.agentId || !tx.agentCommission || tx.agentCommission <= 0) return;

    // Idempotent — don't double-credit
    var existing = await AgentCommission.findOne({ paymentTransaction: tx._id });
    if (existing) return existing;

    var agent = await User.findById(tx.agentId);
    var tierName = agent && agent.agentProfile ? agent.agentProfile.tier : 'iniciante';

    var commission = await AgentCommission.create({
        agent: tx.agentId,
        type: 'rental_commission',
        paymentTransaction: tx._id,
        property: tx.property,
        rental: tx.rental,
        amount: tx.agentCommission,
        tierAtTime: tierName,
        commissionRate: tx.feeAmount > 0 ? tx.agentCommission / tx.feeAmount : 0,
        description: 'Comissao aluguel ' + tx.month,
        status: 'available',
        month: tx.month
    });

    await User.findByIdAndUpdate(tx.agentId, {
        $inc: {
            'agentProfile.totalEarned': tx.agentCommission,
            'agentProfile.availableBalance': tx.agentCommission
        }
    });

    return commission;
}

async function creditBonus(agentId, type, amount, description, propertyId) {
    var agent = await User.findById(agentId);
    var tierName = agent && agent.agentProfile ? agent.agentProfile.tier : 'iniciante';

    var commission = await AgentCommission.create({
        agent: agentId,
        type: type,
        property: propertyId || undefined,
        amount: amount,
        tierAtTime: tierName,
        description: description,
        status: 'available'
    });

    await User.findByIdAndUpdate(agentId, {
        $inc: {
            'agentProfile.totalEarned': amount,
            'agentProfile.availableBalance': amount
        }
    });

    return commission;
}

function generateReferralCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = {
    TIERS,
    calculateTier,
    getTierByName,
    getNextTier,
    recalcAgentTier,
    creditAgentCommission,
    creditBonus,
    generateReferralCode
};
