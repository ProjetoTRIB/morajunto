// ===== MoraJunto — Verificação Facial via IA (Groq Vision) =====
const https = require('https');
const sharp = require('sharp');
const log = require('../utils/logger')('face-verify');

const GROQ_KEY = function() { return process.env.GROQ_API_KEY || ''; };
const GROQ_MODEL = function() { return process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'; };

/**
 * Baixa imagem de uma URL e converte para base64 (redimensionada para economizar tokens).
 */
async function imageUrlToBase64(url) {
    return new Promise(function(resolve, reject) {
        var protocol = url.startsWith('https') ? require('https') : require('http');
        var req = protocol.get(url, function(res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('HTTP ' + res.statusCode + ' ao baixar imagem'));
            }
            var chunks = [];
            res.on('data', function(chunk) { chunks.push(chunk); });
            res.on('end', async function() {
                try {
                    var buffer = Buffer.concat(chunks);
                    var resized = await sharp(buffer, { failOn: 'none' })
                        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                    resolve(resized.toString('base64'));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, function() {
            req.destroy(new Error('Timeout ao baixar imagem'));
        });
    });
}

/**
 * Chama Groq Vision API para analisar selfie + documento.
 * Faz 1 retry com backoff em erros de rede transitórios.
 * Retorna: { approved, confidence, reason, selfieHasFace, documentIsValid, documentType, facesMatch, needsManualReview }
 */
async function verifyFaces(selfieUrl, documentUrl) {
    var key = GROQ_KEY();
    if (!key) {
        log.warn('GROQ_API_KEY não configurada, caindo para revisão manual');
        return { approved: false, confidence: 0, reason: 'GROQ_API_KEY não configurada — verificação manual necessária', needsManualReview: true };
    }

    try {
        var selfieB64 = await imageUrlToBase64(selfieUrl);
        var docB64 = await imageUrlToBase64(documentUrl);

        var result = await callGroqVisionWithRetry(key, selfieB64, docB64);
        return result;
    } catch (e) {
        log.error('erro inesperado', { message: e.message });
        return { approved: false, confidence: 0, reason: 'Erro na análise: ' + e.message, needsManualReview: true };
    }
}

/**
 * Wrapper com 1 retry em erro de rede (não retry em erro da API — resposta explícita).
 */
async function callGroqVisionWithRetry(apiKey, selfieB64, docB64) {
    var first = await callGroqVision(apiKey, selfieB64, docB64);
    if (!first._networkError) return first;

    log.warn('erro de rede, fazendo 1 retry', { reason: first.reason });
    await new Promise(function(r) { setTimeout(r, 1500); });
    var second = await callGroqVision(apiKey, selfieB64, docB64);
    return second;
}

/**
 * Chama Groq com modelo de visão para comparar faces.
 */
function callGroqVision(apiKey, selfieB64, docB64) {
    var body = JSON.stringify({
        model: GROQ_MODEL(),
        messages: [
            {
                role: 'system',
                content: `Você é um sistema de verificação de identidade. Analise as duas imagens:
- Imagem 1: Selfie do usuário
- Imagem 2: Documento de identidade (RG, CNH ou CPF com foto)

Responda APENAS com JSON válido (sem markdown, sem explicação):
{
  "selfie_has_face": true/false,
  "document_is_valid": true/false,
  "document_type": "RG" ou "CNH" ou "CPF" ou "outro" ou "desconhecido",
  "faces_match": true/false,
  "confidence": 0-100,
  "reason": "explicação curta"
}

REGRAS:
- selfie_has_face: true se há um rosto humano claro na selfie
- document_is_valid: true se parece um documento brasileiro real (RG, CNH, etc) com foto
- faces_match: true se o rosto na selfie parece ser a MESMA pessoa do documento
- confidence: 0-100, sua confiança na comparação facial
- Se não conseguir ver rosto em alguma imagem, confidence = 0 e faces_match = false
- Seja rigoroso: só aprove se tiver certeza razoável (confidence >= 70)`
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Imagem 1 - Selfie:' },
                    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + selfieB64 } },
                    { type: 'text', text: 'Imagem 2 - Documento:' },
                    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + docB64 } }
                ]
            }
        ],
        temperature: 0.1,
        max_tokens: 300
    });

    return new Promise(function(resolve) {
        var req = https.request({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try {
                    var parsed = JSON.parse(data);
                    if (parsed.error) {
                        log.error('Groq API error', { message: parsed.error.message });
                        resolve({ approved: false, confidence: 0, reason: 'Erro na API de visão: ' + (parsed.error.message || 'desconhecido'), needsManualReview: true });
                        return;
                    }

                    var content = parsed.choices && parsed.choices[0] && parsed.choices[0].message
                        ? parsed.choices[0].message.content : '';

                    var jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        resolve({ approved: false, confidence: 0, reason: 'Resposta IA inválida', needsManualReview: true });
                        return;
                    }

                    var analysis = JSON.parse(jsonMatch[0]);

                    var approved = analysis.selfie_has_face === true
                        && analysis.document_is_valid === true
                        && analysis.faces_match === true
                        && (analysis.confidence || 0) >= 70;

                    resolve({
                        approved: approved,
                        confidence: analysis.confidence || 0,
                        selfieHasFace: analysis.selfie_has_face || false,
                        documentIsValid: analysis.document_is_valid || false,
                        documentType: analysis.document_type || 'desconhecido',
                        facesMatch: analysis.faces_match || false,
                        reason: analysis.reason || '',
                        needsManualReview: !approved && (analysis.confidence || 0) >= 40
                    });
                } catch (e) {
                    log.error('parse error', { message: e.message });
                    resolve({ approved: false, confidence: 0, reason: 'Erro ao processar resposta', needsManualReview: true });
                }
            });
        });
        req.on('error', function(e) {
            resolve({ approved: false, confidence: 0, reason: 'Erro de conexão: ' + e.message, needsManualReview: true, _networkError: true });
        });
        req.setTimeout(30000, function() {
            req.destroy();
            resolve({ approved: false, confidence: 0, reason: 'Timeout na análise', needsManualReview: true, _networkError: true });
        });
        req.write(body);
        req.end();
    });
}

module.exports = { verifyFaces: verifyFaces };
