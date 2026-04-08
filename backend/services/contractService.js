// ===== MoraJunto — Gerador de Contrato de Aluguel Compartilhado =====
const PDFDocument = require('pdfkit');

function formatCurrency(val) {
    return 'R$ ' + Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
    if (!d) return '___/___/______';
    var date = new Date(d);
    return date.toLocaleDateString('pt-BR');
}

function today() {
    return new Date().toLocaleDateString('pt-BR');
}

// Gera PDF do contrato e retorna como Buffer
function generateContract(data) {
    return new Promise(function(resolve, reject) {
        try {
            var doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
            var buffers = [];
            doc.on('data', function(chunk) { buffers.push(chunk); });
            doc.on('end', function() { resolve(Buffer.concat(buffers)); });

            var owner = data.owner || {};
            var tenants = data.tenants || [];
            var property = data.property || {};
            var rental = data.rental || {};
            var platformFee = rental.platformFee || 8;
            var rentAmount = rental.rentAmount || 0;
            var feeAmount = Math.round(rentAmount * platformFee / 100);
            var totalWithFee = rentAmount + feeAmount;
            var perTenant = tenants.length > 0 ? Math.round(totalWithFee / tenants.length) : totalWithFee;
            var dueDay = rental.dueDay || 10;

            // ===== CABEÇALHO =====
            doc.fontSize(18).font('Helvetica-Bold').text('CONTRATO DE LOCAÇÃO RESIDENCIAL', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text('Intermediado pela Plataforma MoraJunto', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(8).fillColor('#666').text('Documento gerado em ' + today() + ' | morajunto.com.br', { align: 'center' });
            doc.fillColor('#000');
            doc.moveDown(1.5);

            // ===== PARTES =====
            section(doc, 'CLÁUSULA 1ª — DAS PARTES');

            doc.fontSize(10).font('Helvetica-Bold').text('LOCADOR (Proprietário):');
            doc.font('Helvetica').text('Nome: ' + (owner.name || '________________________________'));
            doc.text('CPF: ' + (owner.cpf || '___.___.___-__'));
            doc.text('E-mail: ' + (owner.email || '________________________________'));
            doc.text('Telefone: ' + (owner.phone || '(__)_____-____'));
            doc.moveDown(0.5);

            for (var i = 0; i < Math.max(tenants.length, 1); i++) {
                var t = tenants[i] || {};
                doc.font('Helvetica-Bold').text('LOCATÁRIO ' + (i + 1) + (tenants.length > 1 ? ' (Inquilino ' + (i + 1) + ')' : '') + ':');
                doc.font('Helvetica').text('Nome: ' + (t.name || '________________________________'));
                doc.text('CPF: ' + (t.cpf || '___.___.___-__'));
                doc.text('E-mail: ' + (t.email || '________________________________'));
                doc.moveDown(0.3);
            }

            doc.font('Helvetica-Bold').text('PLATAFORMA INTERMEDIADORA:');
            doc.font('Helvetica').text('MoraJunto — morajunto.com.br');
            doc.text('E-mail: contatomorajunto@gmail.com');
            doc.moveDown(1);

            // ===== OBJETO =====
            section(doc, 'CLÁUSULA 2ª — DO OBJETO');
            doc.fontSize(10).font('Helvetica');
            doc.text('O presente contrato tem por objeto a locação do imóvel situado em:', { continued: false });
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').text('Endereço: ' + (property.address || '________________________________'));
            doc.text('Bairro: ' + (property.neighborhood || '____________') + ' — Cidade: ' + (property.city || 'Ribeirão Preto') + '/SP');
            doc.text('Tipo: ' + (property.type || 'Apartamento') + ' | Quartos: ' + (property.bedrooms || '__') + ' | Banheiros: ' + (property.bathrooms || '__') + ' | Área: ' + (property.area || '__') + 'm²');
            doc.moveDown(1);

            // ===== PRAZO =====
            section(doc, 'CLÁUSULA 3ª — DO PRAZO');
            doc.fontSize(10).font('Helvetica');
            doc.text('O prazo de locação é de 12 (doze) meses, com início em ' + formatDate(rental.startDate) + ', podendo ser renovado automaticamente por períodos iguais, salvo manifestação contrária de qualquer das partes com antecedência mínima de 30 (trinta) dias.');
            doc.moveDown(1);

            // ===== VALOR E PAGAMENTO =====
            section(doc, 'CLÁUSULA 4ª — DO VALOR E FORMA DE PAGAMENTO');
            doc.fontSize(10).font('Helvetica');
            doc.text('4.1. O valor mensal do aluguel é de ' + formatCurrency(rentAmount) + ' (' + numberToWords(rentAmount) + ').');
            doc.moveDown(0.3);
            doc.text('4.2. Sobre o valor do aluguel incide taxa de serviço de ' + platformFee + '% (' + formatCurrency(feeAmount) + '), cobrada pela plataforma MoraJunto do(s) locatário(s), totalizando ' + formatCurrency(totalWithFee) + ' mensais.');
            doc.moveDown(0.3);
            if (tenants.length > 1) {
                doc.text('4.3. O valor será dividido igualmente entre os ' + tenants.length + ' locatários, cabendo a cada um ' + formatCurrency(perTenant) + ' mensais (aluguel + taxa).');
                doc.moveDown(0.3);
            }
            doc.text((tenants.length > 1 ? '4.4' : '4.3') + '. O pagamento deverá ser realizado até o dia ' + dueDay + ' de cada mês, via PIX, através da plataforma MoraJunto.');
            doc.moveDown(0.3);
            doc.text((tenants.length > 1 ? '4.5' : '4.4') + '. O LOCADOR receberá integralmente o valor do aluguel (' + formatCurrency(rentAmount) + '). A taxa de ' + platformFee + '% é de responsabilidade exclusiva do(s) LOCATÁRIO(S).');
            doc.moveDown(1);

            // ===== OBRIGAÇÕES DO LOCADOR =====
            section(doc, 'CLÁUSULA 5ª — OBRIGAÇÕES DO LOCADOR');
            doc.fontSize(10).font('Helvetica');
            var obrigLocador = [
                'Entregar o imóvel em condições adequadas de uso e habitabilidade;',
                'Garantir o uso pacífico do imóvel durante a vigência do contrato;',
                'Responsabilizar-se por vícios e defeitos anteriores à locação;',
                'Comunicar ao(s) locatário(s) qualquer necessidade de manutenção estrutural com antecedência;',
                'Não realizar visitas ao imóvel sem agendamento prévio de 24 horas.'
            ];
            obrigLocador.forEach(function(item) {
                doc.text('• ' + item, { indent: 10 });
            });
            doc.moveDown(1);

            // ===== OBRIGAÇÕES DO LOCATÁRIO =====
            section(doc, 'CLÁUSULA 6ª — OBRIGAÇÕES DO(S) LOCATÁRIO(S)');
            doc.fontSize(10).font('Helvetica');
            var obrigLocatario = [
                'Pagar pontualmente o aluguel e a taxa de serviço na data estipulada;',
                'Zelar pela conservação do imóvel, devolvendo-o no estado em que recebeu;',
                'Não realizar modificações estruturais sem autorização por escrito do locador;',
                'Respeitar as regras de convivência do condomínio/vizinhança;',
                'Comunicar imediatamente ao locador qualquer dano ou necessidade de reparo;',
                'Não sublocar total ou parcialmente sem autorização expressa do locador;',
                'Permitir vistorias previamente agendadas.'
            ];
            obrigLocatario.forEach(function(item) {
                doc.text('• ' + item, { indent: 10 });
            });
            doc.moveDown(1);

            // ===== CAUÇÃO =====
            section(doc, 'CLÁUSULA 7ª — DA GARANTIA (CAUÇÃO)');
            doc.fontSize(10).font('Helvetica');
            doc.text('7.1. Como garantia das obrigações contratuais, o(s) LOCATÁRIO(S) depositará(ão) caução equivalente a 3 (três) meses de aluguel, no valor total de ' + formatCurrency(rentAmount * 3) + ', a ser pago na assinatura deste contrato.');
            doc.moveDown(0.3);
            doc.text('7.2. A caução será devolvida ao final da locação, corrigida pela poupança, descontados eventuais débitos pendentes, danos ao imóvel ou multas contratuais.');
            doc.moveDown(0.3);
            doc.text('7.3. As partes podem acordar, alternativamente, outras formas de garantia previstas na Lei 8.245/91 (fiador, seguro-fiança ou cessão fiduciária), mediante aditivo contratual.');
            doc.moveDown(1);

            // ===== REAJUSTE =====
            section(doc, 'CLÁUSULA 8ª — DO REAJUSTE');
            doc.fontSize(10).font('Helvetica');
            doc.text('8.1. O valor do aluguel será reajustado anualmente, na data-base de aniversário deste contrato, pelo índice IGP-M/FGV acumulado nos últimos 12 meses, ou outro índice que venha a substituí-lo oficialmente.');
            doc.moveDown(0.3);
            doc.text('8.2. Caso o índice seja negativo, o valor do aluguel permanecerá inalterado.');
            doc.moveDown(0.3);
            doc.text('8.3. A plataforma MoraJunto será informada do novo valor para atualização do sistema de cobrança.');
            doc.moveDown(1);

            // ===== ENCARGOS =====
            section(doc, 'CLÁUSULA 9ª — DOS ENCARGOS (IPTU, CONDOMÍNIO E CONSUMO)');
            doc.fontSize(10).font('Helvetica');
            doc.text('9.1. O IPTU do imóvel é de responsabilidade do LOCADOR, salvo acordo expresso em contrário.');
            doc.moveDown(0.3);
            doc.text('9.2. As despesas ordinárias de condomínio (manutenção, limpeza, portaria) são de responsabilidade do(s) LOCATÁRIO(S). Despesas extraordinárias (obras estruturais, fundo de reserva) são do LOCADOR.');
            doc.moveDown(0.3);
            doc.text('9.3. Despesas de consumo individual (água, luz, gás, internet) são de responsabilidade do(s) LOCATÁRIO(S), divididas igualmente em caso de moradia compartilhada.');
            doc.moveDown(1);

            // ===== DANOS =====
            section(doc, 'CLÁUSULA 10ª — DOS DANOS AO IMÓVEL');
            doc.fontSize(10).font('Helvetica');
            doc.text('10.1. O(s) LOCATÁRIO(S) é(são) responsável(is) por quaisquer danos causados ao imóvel, seus acessórios e instalações, salvo desgaste natural pelo uso.');
            doc.moveDown(0.3);
            doc.text('10.2. Reparos necessários decorrentes de mau uso serão custeados pelo(s) LOCATÁRIO(S) em até 15 dias após a constatação, sob pena de desconto na caução.');
            doc.moveDown(0.3);
            doc.text('10.3. Danos causados por caso fortuito ou força maior não são de responsabilidade do(s) LOCATÁRIO(S).');
            doc.moveDown(1);

            // ===== SEGURO =====
            section(doc, 'CLÁUSULA 11ª — DO SEGURO');
            doc.fontSize(10).font('Helvetica');
            doc.text('11.1. O LOCADOR é responsável pela contratação e manutenção de seguro contra incêndio do imóvel, conforme Art. 22 da Lei 8.245/91.');
            doc.moveDown(0.3);
            doc.text('11.2. O(s) LOCATÁRIO(S) poderá(ão), facultativamente, contratar seguro de conteúdo (bens pessoais), sendo este de sua exclusiva responsabilidade.');
            doc.moveDown(1);

            // ===== INADIMPLÊNCIA =====
            section(doc, 'CLÁUSULA 12ª — DA INADIMPLÊNCIA E DESPEJO');
            doc.fontSize(10).font('Helvetica');
            doc.text('12.1. O atraso superior a 30 (trinta) dias no pagamento do aluguel e encargos autoriza o LOCADOR a ingressar com ação de despejo, nos termos da Lei 8.245/91.');
            doc.moveDown(0.3);
            doc.text('12.2. A plataforma MoraJunto notificará o(s) LOCATÁRIO(S) sobre pagamentos em atraso, sem que isso constitua obrigação de cobrança ou responsabilidade pela inadimplência.');
            doc.moveDown(0.3);
            doc.text('12.3. Em caso de moradia compartilhada, a inadimplência de um locatário não exime os demais da responsabilidade solidária pelo valor total.');
            doc.moveDown(1);

            // ===== NOVA PÁGINA =====
            doc.addPage();

            // ===== MORADIA COMPARTILHADA =====
            if (tenants.length > 1) {
                section(doc, 'CLÁUSULA 13ª — DA MORADIA COMPARTILHADA');
                doc.fontSize(10).font('Helvetica');
                var compartilhada = [
                    'Todos os locatários são solidariamente responsáveis pelo pagamento integral do aluguel;',
                    'A saída de um locatário não extingue a obrigação dos demais, devendo o valor ser redistribuído ou um substituto ser apresentado em até 30 dias;',
                    'O substituto deve ser aprovado pelo locador e pelos demais locatários;',
                    'As áreas comuns do imóvel (sala, cozinha, banheiro social) são de uso compartilhado;',
                    'Despesas de consumo (água, luz, gás, internet) serão divididas igualmente, salvo acordo diferente entre os locatários;',
                    'Conflitos de convivência devem ser resolvidos entre os locatários. O locador e a plataforma MoraJunto não se responsabilizam por questões de convivência.'
                ];
                compartilhada.forEach(function(item) {
                    doc.text('• ' + item, { indent: 10 });
                });
                doc.moveDown(1);
            }

            // ===== PLATAFORMA =====
            var clausNum = tenants.length > 1 ? 14 : 13;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DA PLATAFORMA MORAJUNTO');
            doc.fontSize(10).font('Helvetica');
            var plataforma = [
                'A plataforma MoraJunto atua exclusivamente como intermediadora de pagamentos e conexão entre as partes;',
                'A taxa de serviço de ' + platformFee + '% remunera os serviços de intermediação, cobrança e suporte da plataforma;',
                'A plataforma NÃO é fiadora, garantidora ou responsável solidária pelas obrigações das partes;',
                'A plataforma NÃO se responsabiliza pelo estado do imóvel, pela convivência entre locatários ou por inadimplência;',
                'Os pagamentos processados pela plataforma servem como comprovante de quitação mensal;',
                'Em caso de disputa entre as partes, a plataforma poderá fornecer registros de pagamento como prova.'
            ];
            plataforma.forEach(function(item) {
                doc.text('• ' + item, { indent: 10 });
            });
            doc.moveDown(1);

            // ===== MULTA E RESCISÃO =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DA MULTA E RESCISÃO');
            doc.fontSize(10).font('Helvetica');
            doc.text(clausNum + '.1. O atraso no pagamento do aluguel sujeitará o locatário a multa de 2% sobre o valor devido, acrescido de juros de 1% ao mês, pro rata die.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.2. A rescisão antecipada pelo locatário implicará multa equivalente a 3 (três) aluguéis, proporcional ao tempo restante do contrato.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.3. A rescisão por justa causa (descumprimento contratual) não gera obrigação de multa para a parte prejudicada.');
            doc.moveDown(1);

            // ===== RESCISÃO PELO LOCADOR =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DA RESCISÃO PELO LOCADOR');
            doc.fontSize(10).font('Helvetica');
            doc.text(clausNum + '.1. O LOCADOR poderá rescindir o contrato nas hipóteses previstas na Lei 8.245/91, notificando o(s) LOCATÁRIO(S) com antecedência mínima de 30 (trinta) dias.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.2. Em caso de venda do imóvel, o(s) LOCATÁRIO(S) terá(ão) direito de preferência na compra e prazo de 90 dias para desocupação, salvo cláusula de vigência averbada na matrícula.');
            doc.moveDown(1);

            // ===== VISTORIA E ENTREGA =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DA VISTORIA E ENTREGA DE CHAVES');
            doc.fontSize(10).font('Helvetica');
            doc.text(clausNum + '.1. Será realizada vistoria do imóvel no início e no término da locação, documentada por fotos e relatório descritivo, assinado por ambas as partes.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.2. O laudo de vistoria inicial será anexado a este contrato e ficará disponível na plataforma MoraJunto.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.3. A entrega e devolução de chaves serão formalizadas por termo próprio, com data e hora, valendo como marco de início e término da posse.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.4. O(s) LOCATÁRIO(S) deverá(ão) devolver o imóvel no mesmo estado da vistoria inicial, salvo desgaste natural pelo uso.');
            doc.moveDown(1);

            // ===== ACEITE DIGITAL =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DO ACEITE DIGITAL');
            doc.fontSize(10).font('Helvetica');
            doc.text(clausNum + '.1. As partes reconhecem a validade jurídica do aceite digital realizado na plataforma MoraJunto, conforme a Medida Provisória 2.200-2/2001 (infraestrutura de chaves públicas) e o Marco Civil da Internet (Lei 12.965/2014).');
            doc.moveDown(0.3);
            doc.text(clausNum + '.2. O aceite digital registra: identificação do usuário (nome, CPF, e-mail), data e hora (timestamp), e endereço IP, constituindo prova de manifestação de vontade.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.3. As partes podem, facultativamente, imprimir e assinar fisicamente este documento para fins de registro em cartório.');
            doc.moveDown(1);

            // ===== LGPD =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DA PROTEÇÃO DE DADOS (LGPD)');
            doc.fontSize(10).font('Helvetica');
            doc.text(clausNum + '.1. As partes autorizam o tratamento de seus dados pessoais (nome, CPF, e-mail, telefone) pela plataforma MoraJunto para a finalidade exclusiva de execução deste contrato, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).');
            doc.moveDown(0.3);
            doc.text(clausNum + '.2. Os dados serão mantidos durante a vigência do contrato e por 5 (cinco) anos após seu término, para cumprimento de obrigações legais.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.3. Qualquer parte pode solicitar a exclusão de seus dados após o término contratual, respeitadas as obrigações legais de retenção.');
            doc.moveDown(1);

            // ===== DISPOSIÇÕES GERAIS =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DAS DISPOSIÇÕES GERAIS');
            doc.fontSize(10).font('Helvetica');
            doc.text(clausNum + '.1. Este contrato é regido pela Lei 8.245/91 (Lei do Inquilinato) e subsidiariamente pelo Código Civil Brasileiro.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.2. Eventuais alterações a este contrato somente terão validade mediante aditivo por escrito, aceito por todas as partes.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.3. A tolerância de qualquer das partes quanto ao descumprimento de cláusula contratual não constituirá renúncia ao direito de exigi-la posteriormente.');
            doc.moveDown(0.3);
            doc.text(clausNum + '.4. Se qualquer cláusula deste contrato for considerada nula ou inexequível, as demais permanecerão em pleno vigor.');
            doc.moveDown(1);

            // ===== FORO =====
            clausNum++;
            section(doc, 'CLÁUSULA ' + clausNum + 'ª — DO FORO');
            doc.fontSize(10).font('Helvetica');
            doc.text('As partes elegem o Foro da Comarca de Ribeirão Preto — SP para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.');
            doc.moveDown(1.5);

            // ===== ASSINATURAS =====
            doc.text('E por estarem de acordo, as partes firmam o presente contrato.', { align: 'center' });
            doc.moveDown(0.5);
            doc.text('Ribeirão Preto/SP, ' + today(), { align: 'center' });
            doc.moveDown(2);

            // Linhas de assinatura
            var pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            var colWidth = (pageWidth - 40) / 2;

            doc.text('_________________________________', doc.page.margins.left, doc.y, { width: colWidth, align: 'center' });
            doc.text('_________________________________', doc.page.margins.left + colWidth + 40, doc.y - doc.currentLineHeight(), { width: colWidth, align: 'center' });
            doc.moveDown(0.2);
            doc.fontSize(8).text('LOCADOR: ' + (owner.name || ''), doc.page.margins.left, doc.y, { width: colWidth, align: 'center' });
            doc.text('LOCATÁRIO 1: ' + (tenants[0] ? tenants[0].name : ''), doc.page.margins.left + colWidth + 40, doc.y - doc.currentLineHeight(), { width: colWidth, align: 'center' });
            doc.moveDown(0.2);
            doc.fontSize(7).text('CPF: ' + (owner.cpf || ''), doc.page.margins.left, doc.y, { width: colWidth, align: 'center' });
            doc.text('CPF: ' + (tenants[0] ? tenants[0].cpf || '' : ''), doc.page.margins.left + colWidth + 40, doc.y - doc.currentLineHeight(), { width: colWidth, align: 'center' });

            if (tenants.length > 1) {
                doc.moveDown(1.5);
                for (var j = 1; j < tenants.length; j++) {
                    doc.fontSize(10).text('_________________________________', { align: 'center' });
                    doc.moveDown(0.2);
                    doc.fontSize(8).text('LOCATÁRIO ' + (j + 1) + ': ' + (tenants[j].name || ''), { align: 'center' });
                    doc.fontSize(7).text('CPF: ' + (tenants[j].cpf || ''), { align: 'center' });
                    doc.moveDown(1);
                }
            }

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
}

function section(doc, title) {
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
}

function numberToWords(num) {
    // Versão simples pra valores de aluguel
    num = Math.round(num);
    if (num === 0) return 'zero reais';
    var units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    var teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    var tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    var hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    var parts = [];
    if (num >= 1000) {
        var mil = Math.floor(num / 1000);
        if (mil === 1) parts.push('mil');
        else parts.push(units[mil] + ' mil');
        num = num % 1000;
    }
    if (num === 100) { parts.push('cem'); num = 0; }
    else if (num >= 100) { parts.push(hundreds[Math.floor(num / 100)]); num = num % 100; }
    if (num >= 20) { parts.push(tens[Math.floor(num / 10)]); num = num % 10; }
    else if (num >= 10) { parts.push(teens[num - 10]); num = 0; }
    if (num > 0) parts.push(units[num]);

    return parts.join(' e ') + ' reais';
}

module.exports = { generateContract };
