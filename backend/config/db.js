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

    // Fallback: MongoDB in-memory (only for local development)
    if (process.env.NODE_ENV === 'production') {
        dbConnected = false;
        console.log('⚠️  MongoDB não disponível (produção requer Atlas)');
        return;
    }
    try {
        var { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        var uri = memoryServer.getUri();
        await mongoose.connect(uri);
        dbConnected = true;
        console.log('📦 MongoDB local (em memória) conectado');
        console.log('   ⚠️  Dados serão perdidos ao parar o servidor');
    } catch (err) {
        dbConnected = false;
        console.log('⚠️  MongoDB não disponível');
    }
}

connectDB.isConnected = function() { return dbConnected; };

module.exports = connectDB;
