const mongoose = require('mongoose');
const dns = require('dns');

var dbConnected = false;
var memoryServer = null;

async function connectDB() {
    // Force Google DNS to bypass local DNS blocks
    try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e) {}

    // Try Atlas first
    if (process.env.MONGODB_URI) {
        try {
            await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
            dbConnected = true;
            console.log('📦 MongoDB Atlas conectado com sucesso (dados persistentes)');
            return;
        } catch (err) {
            console.log('⚠️  MongoDB Atlas não disponível:', err.message.substring(0, 80));
            console.log('   Tentando MongoDB local...');
        }
    }

    // Fallback: MongoDB local (installed on VPS)
    var localUri = process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/morajunto';
    try {
        await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        dbConnected = true;
        console.log('📦 MongoDB local conectado (' + localUri + ')');
        return;
    } catch (err) {
        console.log('⚠️  MongoDB local não disponível:', err.message.substring(0, 80));
    }

    // Fallback: MongoDB in-memory (only for local development)
    if (process.env.NODE_ENV === 'production') {
        dbConnected = false;
        console.log('⚠️  MongoDB não disponível');
        return;
    }
    try {
        var { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        var uri = memoryServer.getUri();
        await mongoose.connect(uri);
        dbConnected = true;
        console.log('📦 MongoDB em memória conectado');
        console.log('   ⚠️  Dados serão perdidos ao parar o servidor');
    } catch (err) {
        dbConnected = false;
        console.log('⚠️  MongoDB não disponível');
    }
}

connectDB.isConnected = function() { return dbConnected; };

module.exports = connectDB;
