// ===== MoraJunto — Serviço de Email (Resend) =====
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'MoraJunto <noreply@morajunto.com.br>';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function isConfigured() {
    return !!resend;
}

// Template base HTML
function wrapHtml(content) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:linear-gradient(135deg,#4338CA,#6366f1);padding:28px 32px;">
<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">mora<strong>junto</strong></span>
</div>
<div style="padding:32px;">
${content}
</div>
<div style="padding:16px 32px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af;">
<p>&copy; 2026 MoraJunto. Todos os direitos reservados.</p>
<p><a href="${BASE_URL}" style="color:#6366f1;text-decoration:none;">morajunto.com.br</a></p>
</div>
</div>
</body>
</html>`;
}

// Enviar email de verificação com código
async function sendVerificationEmail(to, name, code) {
    if (!resend) {
        console.log('[EMAIL] Resend não configurado. Código de verificação para', to, ':', code);
        return { success: false, reason: 'not_configured' };
    }
    try {
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: 'Confirme seu email — MoraJunto',
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">Olá, ${name}! 👋</h2>
<p style="color:#4b5563;line-height:1.6;">Use o código abaixo para confirmar seu email no MoraJunto:</p>
<div style="text-align:center;margin:24px 0;">
<span style="display:inline-block;background:#f0f0ff;border:2px solid #6366f1;border-radius:8px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#4338CA;">${code}</span>
</div>
<p style="color:#9ca3af;font-size:13px;">Este código expira em 30 minutos. Se você não criou uma conta no MoraJunto, ignore este email.</p>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar verificação:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar proprietário sobre novo lead
async function sendNewLeadEmail(to, ownerName, propertyTitle, tenantName, tenantPhone) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Novo interesse no seu imóvel — ${propertyTitle}`,
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">Novo lead! 🏠</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${ownerName}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;"><strong>${tenantName}</strong> demonstrou interesse no seu imóvel <strong>${propertyTitle}</strong>.</p>
${tenantPhone ? `<p style="color:#4b5563;">Contato: <strong>${tenantPhone}</strong></p>` : ''}
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#4338CA;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Ver no MoraJunto</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar lead:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar pagamento confirmado
async function sendPaymentConfirmedEmail(to, name, amount, propertyTitle) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Pagamento confirmado — ${formatted}`,
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">Pagamento confirmado! ✅</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">Seu pagamento de <strong>${formatted}</strong> referente ao imóvel <strong>${propertyTitle}</strong> foi confirmado com sucesso.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Ver detalhes</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar confirmação:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar verificação aprovada/rejeitada
async function sendVerificationStatusEmail(to, name, status, reason) {
    if (!resend) return { success: false, reason: 'not_configured' };
    var approved = status === 'approved';
    try {
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: approved ? 'Identidade verificada! — MoraJunto' : 'Verificação de identidade — MoraJunto',
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">${approved ? 'Verificação aprovada! ✅' : 'Verificação não aprovada'}</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
${approved
    ? '<p style="color:#4b5563;line-height:1.6;">Sua identidade foi verificada com sucesso. Agora seu perfil tem o selo de verificado!</p>'
    : `<p style="color:#4b5563;line-height:1.6;">Infelizmente sua verificação não foi aprovada.</p>
       ${reason ? `<p style="color:#4b5563;line-height:1.6;"><strong>Motivo:</strong> ${reason}</p>` : ''}
       <p style="color:#4b5563;line-height:1.6;">Você pode tentar novamente enviando novas fotos.</p>`
}
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#4338CA;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Acessar MoraJunto</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar status verificação:', e.message);
        return { success: false, reason: e.message };
    }
}

module.exports = {
    isConfigured,
    sendVerificationEmail,
    sendNewLeadEmail,
    sendPaymentConfirmedEmail,
    sendVerificationStatusEmail
};
