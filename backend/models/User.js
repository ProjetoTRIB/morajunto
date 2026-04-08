const mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'agency', 'admin', 'owner'], default: 'user' },
    phone: { type: String, default: '' },
    cpf: { type: String, unique: true, sparse: true },
    birthDate: { type: Date },
    gender: { type: String, enum: ['', 'masculino', 'feminino', 'nao-binario', 'outro', 'prefiro-nao-dizer'], default: '' },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    emailVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationExpires: { type: Date },

    // Social verification
    facebookUrl: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    socialVerified: { type: Boolean, default: false },
    instagramHandle: { type: String, default: '' },
    facebookHandle: { type: String, default: '' },
    facebookId: { type: String, default: '' },
    facebookVerifiedAt: { type: Date },
    profilePhoto: { type: String, default: '' },

    // Identity verification
    identityVerification: {
        status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
        selfieUrl: { type: String, default: '' },
        documentUrl: { type: String, default: '' },
        submittedAt: { type: Date },
        reviewedAt: { type: Date },
        rejectionReason: { type: String, default: '' }
    },

    // Roommate profile
    roommateProfile: {
        active: { type: Boolean, default: false },
        bio: { type: String, default: '' },
        age: { type: Number },
        gender: { type: String, enum: ['', 'masculino', 'feminino', 'nao-binario', 'outro', 'prefiro-nao-dizer'], default: '' },
        occupation: { type: String, default: '' },
        university: { type: String, default: '' },
        salary: { type: Number, default: 0 },
        budget: { type: Number, default: 0 },
        urgentUntil: { type: Date },
        moveDate: { type: Date },
        neighborhood: { type: String, default: '' },
        cleanliness: { type: Number, min: 1, max: 5, default: 3 },
        noise: { type: Number, min: 1, max: 5, default: 3 },
        sleep: { type: String, enum: ['', 'cedo', 'tarde', 'tanto_faz'], default: '' },
        smoking: { type: Boolean, default: false },
        pets: { type: Boolean, default: false },
        visitors: { type: Number, min: 1, max: 5, default: 3 },
        lookingFor: { type: String, enum: ['', 'roommate', 'apartment', 'both'], default: 'both' },
        groupSize: { type: Number, default: 2 },
        photos: [String],
        course: { type: String, default: '' },
        genderPreference: { type: String, enum: ['', 'mesmo', 'misto', 'feminino', 'masculino', 'neutro'], default: '' },
        ageMin: { type: Number, default: 18 },
        ageMax: { type: Number, default: 40 }
    },

    // Agent/Agency rewards profile
    agentProfile: {
        tier: { type: String, enum: ['iniciante', 'corretor', 'destaque', 'premium', 'elite'], default: 'iniciante' },
        totalEarned: { type: Number, default: 0 },
        availableBalance: { type: Number, default: 0 },
        totalPaidOut: { type: Number, default: 0 },
        activeListings: { type: Number, default: 0 },
        totalRentals: { type: Number, default: 0 },
        referralCode: { type: String, unique: true, sparse: true },
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        firstListingBonusPaid: { type: Boolean, default: false },
        pixKey: { type: String, default: '' }
    },

    // Chave PIX para recebimento (proprietários e indicadores)
    pixKey: { type: String, default: '' },
    pixKeyType: { type: String, enum: ['', 'cpf', 'email', 'telefone', 'aleatoria'], default: '' },

    // Payment score (bom pagador)
    paymentScore: {
        totalOnTime: { type: Number, default: 0 },
        totalLate: { type: Number, default: 0 },
        totalMissed: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
        badge: { type: String, enum: ['none', 'bronze', 'prata', 'ouro'], default: 'none' },
        streakMonths: { type: Number, default: 0 }
    },

    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likedProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikedProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
