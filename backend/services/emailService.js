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

// Email com PIX QR Code pronto para pagamento
async function sendPixPaymentEmail(to, name, amount, month, propertyTitle, pixCode, pixQrBase64, dueDate) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        var dateStr = new Date(dueDate).toLocaleDateString('pt-BR');
        var qrImage = pixQrBase64
            ? `<div style="text-align:center;margin:20px 0;"><img src="data:image/png;base64,${pixQrBase64}" alt="QR Code PIX" style="width:240px;height:240px;border-radius:8px;" /></div>`
            : '';
        var pixCopySection = pixCode
            ? `<div style="background:#f0f0ff;border:1px solid #6366f1;border-radius:8px;padding:12px;margin:16px 0;word-break:break-all;font-size:12px;color:#4338CA;text-align:center;"><strong>PIX Copia e Cola:</strong><br/>${pixCode}</div>`
            : '';
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `PIX pronto: ${formatted} — Aluguel ${month}`,
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">Seu aluguel está pronto para pagamento!</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">O aluguel de <strong>${formatted}</strong> referente a <strong>${propertyTitle}</strong> (${month}) foi gerado.</p>
<p style="color:#4b5563;line-height:1.6;">Vencimento: <strong>${dateStr}</strong></p>

<div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
<p style="color:#1f2937;font-weight:700;font-size:18px;margin:0 0 8px;">Pague via PIX</p>
<p style="color:#4b5563;font-size:14px;margin:0 0 16px;">Escaneie o QR Code ou copie o código abaixo</p>
${qrImage}
${pixCopySection}
</div>

<p style="color:#9ca3af;font-size:13px;">O pagamento é confirmado automaticamente via PIX. Você receberá um email de confirmação assim que pagar.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#4338CA;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Abrir MoraJunto</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar PIX email:', e.message);
        return { success: false, reason: e.message };
    }
}

// Lembrete de pagamento (3 dias antes ou no dia)
async function sendPaymentReminderEmail(to, name, amount, dueDate, propertyTitle) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        var dateStr = new Date(dueDate).toLocaleDateString('pt-BR');
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Lembrete: pagamento de ${formatted} vence em ${dateStr}`,
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">Lembrete de pagamento</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">Seu aluguel de <strong>${formatted}</strong> referente a <strong>${propertyTitle}</strong> vence em <strong>${dateStr}</strong>.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#4338CA;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Pagar agora</a>
</div>
<p style="color:#9ca3af;font-size:13px;">Pague via PIX para confirmação instantânea.</p>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar lembrete:', e.message);
        return { success: false, reason: e.message };
    }
}

// Aviso de atraso
async function sendPaymentLateEmail(to, name, amount, dueDate, propertyTitle) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        var dateStr = new Date(dueDate).toLocaleDateString('pt-BR');
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Pagamento em atraso — ${formatted}`,
            html: wrapHtml(`
<h2 style="color:#dc2626;margin:0 0 12px;">Pagamento em atraso</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">Seu aluguel de <strong>${formatted}</strong> referente a <strong>${propertyTitle}</strong> venceu em <strong>${dateStr}</strong> e ainda não foi pago.</p>
<p style="color:#4b5563;line-height:1.6;">Por favor, regularize o pagamento o quanto antes para manter seu score de pagador em dia.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Pagar agora</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar aviso atraso:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar proprietário de pagamento atrasado
async function sendOwnerLateNoticeEmail(to, ownerName, tenantName, amount, dueDate, propertyTitle) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        var dateStr = new Date(dueDate).toLocaleDateString('pt-BR');
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Pagamento atrasado de ${tenantName}`,
            html: wrapHtml(`
<h2 style="color:#1f2937;margin:0 0 12px;">Inquilino com pagamento atrasado</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${ownerName}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">O inquilino <strong>${tenantName}</strong> tem um pagamento de <strong>${formatted}</strong> referente a <strong>${propertyTitle}</strong> que venceu em <strong>${dateStr}</strong> e ainda não foi pago.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#4338CA;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Ver detalhes</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar aviso ao proprietário:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar proprietário de repasse
async function sendOwnerTransferEmail(to, ownerName, amount, month) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Repasse de ${formatted} realizado — ${month}`,
            html: wrapHtml(`
<h2 style="color:#16a34a;margin:0 0 12px;">Repasse realizado!</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${ownerName}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">Todos os inquilinos pagaram o aluguel referente a <strong>${month}</strong>.</p>
<p style="color:#4b5563;line-height:1.6;">O valor de <strong>${formatted}</strong> foi transferido via PIX para sua conta.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Ver detalhes</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar notificação de repasse:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar inquilino que contrato está pronto para aceite
async function sendContractReadyEmail(to, tenantName, ownerName, propertyTitle, rentAmount) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        var formatted = 'R$ ' + Number(rentAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Contrato pronto para assinatura — ${propertyTitle}`,
            html: wrapHtml(`
<h2 style="color:#8B5CF6;margin:0 0 12px;">Seu contrato está pronto!</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${tenantName}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">O proprietário <strong>${ownerName}</strong> disponibilizou o contrato de locação do imóvel <strong>${propertyTitle}</strong> (${formatted}/mês).</p>
<p style="color:#4b5563;line-height:1.6;">Acesse a plataforma para ler as cláusulas, baixar o PDF e aceitar digitalmente.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#8B5CF6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Ver contrato</a>
</div>
<p style="color:#9ca3af;font-size:0.85rem;line-height:1.5;">O aceite digital tem validade jurídica conforme MP 2.200-2/2001 e Marco Civil da Internet.</p>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar notificação de contrato:', e.message);
        return { success: false, reason: e.message };
    }
}

// Notificar todas as partes que o contrato foi aceito por todos
async function sendAllPartiesAcceptedEmail(to, name, propertyTitle) {
    if (!resend) return { success: false, reason: 'not_configured' };
    try {
        await resend.emails.send({
            from: FROM,
            to: [to],
            subject: `Contrato assinado por todas as partes — ${propertyTitle}`,
            html: wrapHtml(`
<h2 style="color:#16a34a;margin:0 0 12px;">Contrato totalmente assinado!</h2>
<p style="color:#4b5563;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
<p style="color:#4b5563;line-height:1.6;">Todas as partes aceitaram o contrato de locação do imóvel <strong>${propertyTitle}</strong>.</p>
<p style="color:#4b5563;line-height:1.6;">O contrato está ativo e disponível para download na plataforma.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${BASE_URL}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Baixar contrato</a>
</div>
`)
        });
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erro ao enviar confirmação de contrato:', e.message);
        return { success: false, reason: e.message };
    }
}

module.exports = {
    isConfigured,
    sendVerificationEmail,
    sendNewLeadEmail,
    sendPaymentConfirmedEmail,
    sendVerificationStatusEmail,
    sendPixPaymentEmail,
    sendPaymentReminderEmail,
    sendPaymentLateEmail,
    sendOwnerLateNoticeEmail,
    sendOwnerTransferEmail,
    sendContractReadyEmail,
    sendAllPartiesAcceptedEmail
};
