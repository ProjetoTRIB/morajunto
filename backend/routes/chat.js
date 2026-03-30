const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Property = require('../models/Property');
const authMiddleware = require('../middleware/auth');
const { validateId } = require('../middleware/validateId');

router.use(authMiddleware);

// Anti-bypass: detect phone numbers, emails, whatsapp
// Step 1: Normalize text (strip zero-width chars, normalize unicode, collapse spaces)
function normalizeText(text) {
    // Remove zero-width characters (U+200B, U+200C, U+200D, U+FEFF, U+00AD)
    var cleaned = text.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u034F\u2060\u2061\u2062\u2063\u2064]/g, '');
    // Normalize unicode (Cyrillic/Greek lookalikes → Latin)
    var charMap = {
        '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c',
        '\u0443': 'y', '\u0445': 'x', '\u0456': 'i', '\u0410': 'A', '\u0415': 'E',
        '\u041E': 'O', '\u0420': 'P', '\u0421': 'C', '\u03B1': 'a', '\u03BF': 'o',
        '\u03B5': 'e', '\u03B9': 'i'
    };
    cleaned = cleaned.split('').map(function(c) { return charMap[c] || c; }).join('');
    // Collapse multiple spaces/dots/dashes between single chars (w.h.a.t.s → whats)
    cleaned = cleaned.replace(/([a-zA-Z])[\s.\-_]+(?=[a-zA-Z](?:[\s.\-_]|$))/g, '$1');
    return cleaned;
}

function containsContactInfo(rawText) {
    var text = normalizeText(rawText);
    var lower = text.toLowerCase();

    var patterns = [
        /\b\d{2}[\s\-.]?\d{4,5}[\s\-.]?\d{4}\b/,           // phone: 16 99999-0000
        /\(\d{2}\)\s?\d{4,5}[\-\s]?\d{4}/,                    // (16) 99999-0000
        /\b\d{10,11}\b/,                                       // 11 digits straight: 16999990000
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, // email
        /whats\s*app/i,                                         // "whatsapp"
        /wpp/i,                                                 // "wpp"
        /\bzap\b/i,                                             // "zap" (word boundary to avoid "zapato")
        /me\s*chama?\s*n[oa]/i,                                 // "me chama no/na"
        /meu\s*(numero|telefone|cel|celular|fone|zap|whats|contato)/i, // "meu numero/contato"
        /manda?\s*(msg|mensagem)\s*(no|pelo|via|pro)/i,         // "manda msg no"
        /instagram\.com\//i,                                     // instagram link
        /facebook\.com\//i,                                      // facebook link
        /fb\.com\//i,                                            // fb short link
        /wa\.me\//i,                                             // whatsapp link
        /t\.me\//i,                                              // telegram link
        /api\.whatsapp\.com/i,                                   // whatsapp api link
        /@[a-zA-Z0-9_.]{3,30}\b/,                               // @username (insta/twitter)
        /\b(telegram|tele\s*gram)\b/i,                           // "telegram"
        /\bsignal\b/i,                                           // "signal" app
        /https?:\/\/[^\s]+/i,                                       // any URL with http/https
        /www\.[a-zA-Z0-9][^\s]*/i,                                  // www. links
        /bit\.ly\//i,                                               // URL shorteners
        /tinyurl\.com\//i,
        /goo\.gl\//i,
        /linktr\.ee\//i,
        /cutt\.ly\//i,
        /is\.gd\//i,
    ];

    if (patterns.some(function(p) { return p.test(text); })) return true;

    // Keyword detection (Portuguese text-based bypass attempts)
    var keywords = [
        'arroba', 'ponto com', 'gmail', 'hotmail', 'outlook', 'yahoo',
        'me liga', 'me add', 'me segue', 'me chama', 'meu face',
        'meu insta', 'meu tel', 'meu zap', 'meu whats', 'meu numero',
        'chama no', 'fala no', 'passa teu', 'passa seu', 'passa o',
        'qual seu numero', 'qual teu numero', 'qual o numero',
        'qual seu tel', 'qual teu tel', 'qual seu whats', 'qual teu whats',
        'qual seu insta', 'qual teu insta', 'qual seu face', 'qual teu face',
        'add no face', 'add no insta', 'segue no insta'
    ];

    if (keywords.some(function(k) { return lower.includes(k); })) return true;

    // DDD pattern: 2 digits + 8-9 digits with any separators
    var digitsOnly = text.replace(/\D/g, '');
    if (/\b(1[1-9]|2[1-9]|3[1-5]|4[1-9]|5[1-5]|6[1-9]|7[1-9]|8[1-9]|9[1-9])9?\d{8}\b/.test(digitsOnly)) {
        return true;
    }

    return false;
}

// POST /api/chat/conversations — create or get existing conversation
router.post('/conversations', async (req, res) => {
    try {
        var { recipientId, propertyId } = req.body;
        if (!recipientId || typeof recipientId !== 'string' || !/^[a-f\d]{24}$/i.test(recipientId)) {
            return res.status(400).json({ error: 'Destinatário inválido' });
        }
        if (propertyId && (typeof propertyId !== 'string' || !/^[a-f\d]{24}$/i.test(propertyId))) {
            return res.status(400).json({ error: 'ID do imóvel inválido' });
        }

        // Match-only chat: require mutual match OR property context
        if (!propertyId) {
            var sender = await User.findById(req.user.userId).select('matches');
            var isMutualMatch = sender && sender.matches && sender.matches.some(function(id) { return id.toString() === recipientId; });
            if (!isMutualMatch) {
                return res.status(403).json({ error: 'Voce so pode conversar com matches mutuos ou sobre um imovel especifico.' });
            }
        }

        // Check if conversation already exists between these 2 about this property
        var existing = await Conversation.findOne({
            participants: { $all: [req.user.userId, recipientId] },
            property: propertyId || null
        });

        if (existing) {
            // Mark as read
            existing.unreadBy = existing.unreadBy.filter(function(id) { return id.toString() !== req.user.userId; });
            await existing.save();
            return res.json({ conversation: existing });
        }

        // Get property title
        var propTitle = '';
        if (propertyId) {
            var prop = await Property.findById(propertyId);
            if (prop) propTitle = prop.title;
        }

        // Create new conversation
        var conversation = await Conversation.create({
            participants: [req.user.userId, recipientId],
            property: propertyId || undefined,
            propertyTitle: propTitle,
            messages: [],
            status: 'active'
        });

        res.status(201).json({ conversation });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar conversa' });
    }
});

// GET /api/chat/conversations — list user's conversations
router.get('/conversations', async (req, res) => {
    try {
        var conversations = await Conversation.find({
            participants: req.user.userId,
            status: 'active'
        })
        .populate('participants', 'name profilePhoto role')
        .populate('property', 'title neighborhood price')
        .sort({ lastMessageAt: -1 });

        // Add unread count and other participant name
        var result = conversations.map(function(c) {
            var other = c.participants.find(function(p) { return p._id.toString() !== req.user.userId; });
            var unread = c.unreadBy.some(function(id) { return id.toString() === req.user.userId; });
            return {
                _id: c._id,
                otherUser: other ? { _id: other._id, name: other.name, profilePhoto: other.profilePhoto, role: other.role } : null,
                property: c.property,
                propertyTitle: c.propertyTitle,
                lastMessage: c.lastMessage,
                lastMessageAt: c.lastMessageAt,
                unread: unread,
                messageCount: c.messages.length
            };
        });

        // Count total unread
        var totalUnread = result.filter(function(c) { return c.unread; }).length;

        res.json({ conversations: result, totalUnread: totalUnread });
    } catch (e) {
        res.json({ conversations: [], totalUnread: 0 });
    }
});

// GET /api/chat/conversations/:id — get messages
router.get('/conversations/:id', validateId('id'), async (req, res) => {
    try {
        var conversation = await Conversation.findById(req.params.id)
            .populate('participants', 'name profilePhoto role')
            .populate('property', 'title neighborhood price');

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

        // Check participant
        var isParticipant = conversation.participants.some(function(p) { return p._id.toString() === req.user.userId; });
        if (!isParticipant) return res.status(403).json({ error: 'Acesso negado' });

        // Mark as read
        conversation.unreadBy = conversation.unreadBy.filter(function(id) { return id.toString() !== req.user.userId; });
        await conversation.save();

        var other = conversation.participants.find(function(p) { return p._id.toString() !== req.user.userId; });

        res.json({
            conversation: {
                _id: conversation._id,
                otherUser: other,
                property: conversation.property,
                propertyTitle: conversation.propertyTitle,
                messages: conversation.messages,
                status: conversation.status
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar conversa' });
    }
});

// POST /api/chat/conversations/:id/messages — send message
router.post('/conversations/:id/messages', validateId('id'), async (req, res) => {
    try {
        var text = (req.body.text || '').substring(0, 2000);
        if (!text.trim()) return res.status(400).json({ error: 'Mensagem vazia' });

        var conversation = await Conversation.findById(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

        // Check participant
        var isParticipant = conversation.participants.some(function(id) { return id.toString() === req.user.userId; });
        if (!isParticipant) return res.status(403).json({ error: 'Acesso negado' });

        // Anti-bypass: check for contact info
        var blocked = containsContactInfo(text);

        var sender = await User.findById(req.user.userId);

        var message = {
            sender: req.user.userId,
            senderName: sender ? sender.name : 'Usuário',
            text: blocked ? '[Mensagem bloqueada — compartilhar dados de contato é proibido pelos Termos de Uso]' : text.trim(),
            blocked: blocked,
            createdAt: new Date()
        };

        conversation.messages.push(message);
        conversation.lastMessage = blocked ? 'Mensagem bloqueada' : text.trim().substring(0, 100);
        conversation.lastMessageAt = new Date();

        // Mark as unread for the other participant
        var otherId = conversation.participants.find(function(id) { return id.toString() !== req.user.userId; });
        if (otherId && !conversation.unreadBy.includes(otherId)) {
            conversation.unreadBy.push(otherId);
        }

        await conversation.save();

        if (blocked) {
            return res.status(400).json({
                error: 'Mensagem bloqueada. Compartilhar telefone, email, WhatsApp ou redes sociais é proibido pelos Termos de Uso. Toda comunicação deve ser feita pela plataforma.',
                blocked: true
            });
        }

        // Emit real-time event via Socket.io
        var io = req.app.get('io');
        var onlineUsers = req.app.get('onlineUsers');
        if (io && otherId) {
            var recipientSocket = onlineUsers.get(otherId.toString());
            if (recipientSocket) {
                io.to(recipientSocket).emit('new-message', {
                    conversationId: conversation._id,
                    message: message,
                    senderName: sender ? sender.name : 'Usuário'
                });
            }
        }

        res.json({ message: message });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// GET /api/chat/unread — count unread conversations
router.get('/unread', async (req, res) => {
    try {
        var count = await Conversation.countDocuments({
            participants: req.user.userId,
            unreadBy: req.user.userId,
            status: 'active'
        });
        res.json({ unread: count });
    } catch (e) {
        res.json({ unread: 0 });
    }
});

module.exports = router;
