// ===== MoraJunto — Serviço Asaas (Pagamentos PIX + Split) =====
const https = require('https');

const API_KEY = process.env.ASAAS_API_KEY || '';
const BASE = process.env.ASAAS_ENV === 'sandbox' ? 'sandbox.asaas.com' : 'api.asaas.com';

function asaasRequest(method, path, body) {
    return new Promise(function(resolve, reject) {
        var bodyStr = body ? JSON.stringify(body) : '';
        var options = {
            hostname: BASE,
            path: '/v3' + path,
            method: method,
            headers: {
                'access_token': API_KEY,
                'Content-Type': 'application/json'
            }
        };
        if (bodyStr && (method === 'POST' || method === 'PUT')) {
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }
        var req = https.request(options, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try {
                    var parsed = JSON.parse(data);
                    if (parsed.errors) {
                        reject(new Error(parsed.errors.map(function(e) { return e.description; }).join(', ')));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error('Asaas: resposta inválida'));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, function() { req.destroy(); reject(new Error('Asaas: timeout')); });
        if (bodyStr && (method === 'POST' || method === 'PUT')) req.write(bodyStr);
        req.end();
    });
}

function isConfigured() {
    return !!API_KEY;
}

// Criar ou buscar cliente no Asaas
async function ensureCustomer(name, cpfCnpj, email) {
    // Buscar existente por CPF
    var cpfClean = cpfCnpj.replace(/\D/g, '');
    try {
        var existing = await asaasRequest('GET', '/customers?cpfCnpj=' + cpfClean);
        if (existing.data && existing.data.length > 0) {
            return existing.data[0];
        }
    } catch (e) {
        console.error('[ASAAS] Erro ao buscar cliente:', e.message);
    }

    // Criar novo
    return await asaasRequest('POST', '/customers', {
        name: name.substring(0, 100),
        cpfCnpj: cpfClean,
        email: email
    });
}

// Criar cobrança PIX
async function createPixCharge(customerId, amount, dueDate, description) {
    return await asaasRequest('POST', '/payments', {
        customer: customerId,
        billingType: 'PIX',
        value: amount,
        dueDate: dueDate, // formato YYYY-MM-DD
        description: description.substring(0, 200)
    });
}

// Buscar QR Code PIX de uma cobrança
async function getPixQrCode(paymentId) {
    return await asaasRequest('GET', '/payments/' + paymentId + '/pixQrCode');
}

// Consultar status de uma cobrança
async function getPaymentStatus(paymentId) {
    return await asaasRequest('GET', '/payments/' + paymentId);
}

// Consultar saldo da conta
async function getBalance() {
    return await asaasRequest('GET', '/finance/balance');
}

// Criar transferência (payout pro proprietário)
async function createTransfer(amount, pixKey, pixKeyType, description) {
    var typeMap = { cpf: 'CPF', email: 'EMAIL', telefone: 'PHONE', aleatoria: 'EVP' };
    return await asaasRequest('POST', '/transfers', {
        value: amount,
        operationType: 'PIX',
        pixAddressKey: pixKey,
        pixAddressKeyType: typeMap[pixKeyType] || 'EVP',
        description: (description || 'Repasse aluguel MoraJunto').substring(0, 200)
    });
}

module.exports = {
    isConfigured,
    ensureCustomer,
    createPixCharge,
    getPixQrCode,
    getPaymentStatus,
    getBalance,
    createTransfer
};
