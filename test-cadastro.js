// Simula 5 cadastros reais de proprietarios + imoveis
// Testa o fluxo completo: registro owner -> login -> cadastrar imovel -> verificar
const API = 'http://localhost:3000/api';

const U = 'https://images.unsplash.com/';

const owners = [
    {
        owner: { name: 'Marcos Roberto Silva', email: 'marcos.silva.prop@teste.com', password: 'Teste@123', role: 'owner', cpf: '508.732.305-74', birthDate: '1978-06-20', gender: 'masculino' },
        property: {
            title: 'Apto 2 quartos reformado - Centro, proximo ao Calcadao',
            price: 1350, type: 'apartamento', neighborhood: 'Centro',
            address: 'Rua General Osorio, 540',
            bedrooms: 2, bathrooms: 1, area: 68, parking: 1,
            description: 'Apartamento reformado com 2 dormitorios no centro de Ribeirao Preto. Piso porcelanato, cozinha planejada com armarios, area de servico fechada. Proximo ao calcadao, farmacias e supermercados. 1 vaga coberta. Condominio com portaria.',
            features: ['Reformado', 'Cozinha planejada', 'Porcelanato', 'Portaria', 'Garagem coberta'],
            images: [
                U+'photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop',
                U+'photo-1560185893-a55cbc8c57e8?w=900&h=600&fit=crop',
                U+'photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop',
                U+'photo-1484154218962-a197022b5858?w=900&h=600&fit=crop',
                U+'photo-1552321554-5fefe8c9ef14?w=900&h=600&fit=crop'
            ]
        }
    },
    {
        owner: { name: 'Ana Paula Ferreira', email: 'ana.ferreira.prop@teste.com', password: 'Teste@123', role: 'owner', cpf: '063.207.437-00', birthDate: '1982-11-08', gender: 'feminino' },
        property: {
            title: 'Kitnet semi-mobiliada Vila Tiberio - ideal estudantes',
            price: 850, type: 'kitnet', neighborhood: 'Vila Tibério',
            address: 'Rua Prudente de Morais, 220',
            bedrooms: 1, bathrooms: 1, area: 32,
            description: 'Kitnet semi-mobiliada no Vila Tiberio, a 10 minutos do campus da USP de onibus. Inclui cama, guarda-roupa e fogao. Agua inclusa no aluguel. Regiao com muito comercio e transporte facil.',
            features: ['Semi-mobiliado', 'Agua inclusa', 'Proximo USP', 'Comercio na rua'],
            images: [
                U+'photo-1616486338812-3dadae4b4ace?w=900&h=600&fit=crop',
                U+'photo-1631049307264-da0ec9d70304?w=900&h=600&fit=crop',
                U+'photo-1556909114-f6e7ad7d3136?w=900&h=600&fit=crop',
                U+'photo-1620626011761-996317b8d101?w=900&h=600&fit=crop'
            ]
        }
    },
    {
        owner: { name: 'Roberto Almeida Santos', email: 'roberto.santos.prop@teste.com', password: 'Teste@123', role: 'owner', cpf: '822.155.037-00', birthDate: '1975-04-30', gender: 'masculino' },
        property: {
            title: 'Apto 3 quartos com suite e varanda - Nova Alianca',
            price: 2800, type: 'apartamento', neighborhood: 'Nova Aliança',
            address: 'Rua Arnaldo Victaliano, 890',
            bedrooms: 3, bathrooms: 2, area: 95, parking: 2,
            description: 'Apartamento amplo com 3 dormitorios sendo 1 suite com closet. Varanda com churrasqueira, sala para 2 ambientes. Condominio com piscina, academia e salao de festas. Proximo ao Shopping Iguatemi.',
            features: ['Suite com closet', 'Varanda gourmet', 'Piscina', 'Academia', '2 vagas', 'Churrasqueira'],
            images: [
                U+'photo-1586023492125-27b2c045efd7?w=900&h=600&fit=crop',
                U+'photo-1617325247661-675ab4b64ae2?w=900&h=600&fit=crop',
                U+'photo-1600607687939-ce8a6c25118c?w=900&h=600&fit=crop',
                U+'photo-1560185127-6ed189bf02f4?w=900&h=600&fit=crop',
                U+'photo-1567767292278-a4f21aa2d36e?w=900&h=600&fit=crop'
            ]
        }
    },
    {
        owner: { name: 'Patricia Oliveira Costa', email: 'patricia.costa.prop@teste.com', password: 'Teste@123', role: 'owner', cpf: '176.312.726-54', birthDate: '1988-09-12', gender: 'feminino' },
        property: {
            title: 'Casa 4 quartos com piscina - Jardim Sumare',
            price: 3500, type: 'casa', neighborhood: 'Jardim Sumaré',
            address: 'Rua Conde Afonso Celso, 315',
            bedrooms: 4, bathrooms: 3, area: 180, parking: 2,
            description: 'Casa espaçosa com 4 dormitorios (2 suites), piscina com deck, churrasqueira coberta e quintal gramado. Rua tranquila e arborizada. Ideal para republica de estudantes ou familia grande. Proximo a escolas e supermercados.',
            features: ['2 suites', 'Piscina', 'Churrasqueira', 'Quintal', '2 vagas', 'Rua tranquila'],
            images: [
                U+'photo-1564013799919-ab600027ffc6?w=900&h=600&fit=crop',
                U+'photo-1600585154340-be6161a56a0c?w=900&h=600&fit=crop',
                U+'photo-1618221195710-dd6b41faaea6?w=900&h=600&fit=crop',
                U+'photo-1615874959474-d609969a20ed?w=900&h=600&fit=crop',
                U+'photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop'
            ]
        }
    },
    {
        owner: { name: 'Fernando Gomes Ribeiro', email: 'fernando.ribeiro.prop@teste.com', password: 'Teste@123', role: 'owner', cpf: '813.136.386-41', birthDate: '1990-01-25', gender: 'masculino' },
        property: {
            title: 'Studio novo com lazer completo - Campos Eliseos',
            price: 1100, type: 'kitnet', neighborhood: 'Campos Elíseos',
            address: 'Rua Sete de Setembro, 470',
            bedrooms: 1, bathrooms: 1, area: 38, parking: 1,
            description: 'Studio novo, nunca habitado, em predio recente com lazer completo. Piscina, academia, salao gourmet e bicicletario. Proximo a faculdades e ao Ribeirao Shopping. Aceita pet de pequeno porte.',
            features: ['Novo', 'Piscina', 'Academia', 'Aceita pet', 'Bicicletario', 'Garagem'],
            images: [
                U+'photo-1616594039964-ae9021a400a0?w=900&h=600&fit=crop',
                U+'photo-1556909114-f6e7ad7d3136?w=900&h=600&fit=crop',
                U+'photo-1560185893-a55cbc8c57e8?w=900&h=600&fit=crop',
                U+'photo-1552321554-5fefe8c9ef14?w=900&h=600&fit=crop'
            ]
        }
    }
];

async function test() {
    console.log('=== SIMULACAO DE 5 CADASTROS REAIS ===\n');

    for (let i = 0; i < owners.length; i++) {
        let o = owners[i];
        console.log(`--- Proprietario ${i+1}: ${o.owner.name} ---`);

        // 1. Registrar como owner
        let regRes = await fetch(API + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(o.owner)
        });
        let regData = await regRes.json();

        if (!regData.token) {
            // Try login if already registered
            let loginRes = await fetch(API + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: o.owner.email, password: o.owner.password })
            });
            regData = await loginRes.json();
        }

        if (!regData.token) {
            console.log('  FALHA: Nao conseguiu registrar/login -', regData.error);
            continue;
        }

        let token = regData.token;
        let user = regData.user;
        console.log('  1. Registro: OK | Role:', user.role, '| ID:', user.id || user._id);

        // 2. Verificar que eh owner
        let meRes = await fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
        let meData = await meRes.json();
        let me = meData.user || meData;
        console.log('  2. /auth/me: Role =', me.role, (me.role === 'owner' ? 'OK' : 'ERRO'));

        // 3. Cadastrar imovel
        let propRes = await fetch(API + '/owner/properties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(o.property)
        });
        let propData = await propRes.json();

        if (propData.property) {
            console.log('  3. Imovel criado: OK |', propData.property.title);
            console.log('     Preco: R$' + propData.property.price, '| Fotos:', propData.property.images.length);
        } else {
            console.log('  3. FALHA ao criar imovel:', propData.error);
            continue;
        }

        // 4. Verificar que aparece na listagem
        let listRes = await fetch(API + '/owner/properties', { headers: { 'Authorization': 'Bearer ' + token } });
        let listData = await listRes.json();
        console.log('  4. Meus imoveis:', (listData.properties||[]).length, 'encontrado(s)');

        // 5. Verificar stats
        let statsRes = await fetch(API + '/owner/stats', { headers: { 'Authorization': 'Bearer ' + token } });
        let stats = await statsRes.json();
        console.log('  5. Stats: properties=' + stats.properties, '| rentals=' + stats.activeRentals);

        // 6. Verificar que aparece na busca publica
        let searchRes = await fetch(API + '/properties?neighborhood=' + encodeURIComponent(o.property.neighborhood));
        let searchData = await searchRes.json();
        let found = (searchData.properties||[]).find(p => p.title === o.property.title);
        console.log('  6. Busca publica:', found ? 'ENCONTRADO' : 'NAO ENCONTRADO');

        // 7. Verificar detalhe com galeria
        if (found) {
            let detRes = await fetch(API + '/properties/' + found._id);
            let det = await detRes.json();
            console.log('  7. Detalhe: images=' + (det.images||[]).length, '| title=' + det.title.substring(0,40));

            // Check no contact leak
            let agency = det.agency || {};
            let hasPhone = 'phone' in agency;
            let hasEmail = 'email' in agency;
            console.log('  8. Seguranca: phone_leak=' + hasPhone, '| email_leak=' + hasEmail, (hasPhone || hasEmail ? 'FALHA' : 'OK'));
        }

        console.log('');
    }

    // Final: check total properties in platform
    let totalRes = await fetch(API + '/properties');
    let totalData = await totalRes.json();
    console.log('=== TOTAL DE IMOVEIS NA PLATAFORMA:', totalData.total, '===');

    // Check featured
    let featRes = await fetch(API + '/properties/featured');
    let feat = await featRes.json();
    console.log('=== DESTAQUES NA HOMEPAGE:', feat.length, '===');
}

test().catch(e => console.error('ERRO FATAL:', e));
