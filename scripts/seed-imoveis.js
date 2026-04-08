// ===== Seed: Imóveis realistas de Ribeirão Preto =====
// Rodar: node scripts/seed-imoveis.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/morajunto';

const User = require('../backend/models/User');
const Property = require('../backend/models/Property');

// Fotos genéricas Unsplash (apartamentos/casas — sem copyright issues)
const PHOTOS = {
    apto: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=500&fit=crop',
    ],
    sala: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=500&fit=crop',
    ],
    kitnet: [
        'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=500&fit=crop',
    ],
    casa: [
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=500&fit=crop',
    ]
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Dados das imobiliárias/proprietários fictícios
const AGENCIES = [
    { name: 'Ribeirão Imóveis', email: 'ribeiraoimoveis@morajunto.test', phone: '(16) 99201-1001', role: 'agency' },
    { name: 'Casa Fácil RP', email: 'casafacilrp@morajunto.test', phone: '(16) 99302-2002', role: 'agency' },
    { name: 'Moradia Preto', email: 'moradiapreto@morajunto.test', phone: '(16) 99403-3003', role: 'agency' },
    { name: 'Carlos Mendes', email: 'carlos.mendes@morajunto.test', phone: '(16) 99504-4004', role: 'owner' },
    { name: 'Ana Paula Ribeiro', email: 'ana.ribeiro@morajunto.test', phone: '(16) 99605-5005', role: 'owner' },
];

// Imóveis realistas
const IMOVEIS = [
    // Zona Sul (mais caro)
    { title: 'Apartamento 2 quartos no Jardim Sumaré', type: 'apartamento', price: 1800, neighborhood: 'Jardim Sumaré', bedrooms: 2, bathrooms: 1, area: 65, address: 'Rua Machado de Assis, 450', desc: 'Apartamento bem localizado no Jardim Sumaré, próximo a comércios e transporte. Sala ampla, cozinha planejada, 2 quartos com armários. Condomínio com portaria 24h e vaga de garagem.', features: ['Portaria 24h', 'Vaga de garagem', 'Armários', 'Cozinha planejada'], photos: PHOTOS.apto },
    { title: 'Kitnet mobiliada próxima à USP', type: 'kitnet', price: 950, neighborhood: 'Sumarezinho', bedrooms: 1, bathrooms: 1, area: 28, address: 'Rua Saldanha Marinho, 182', desc: 'Kitnet totalmente mobiliada a 5 min da USP Ribeirão. Ideal para estudantes. Inclui cama, mesa de estudos, geladeira e micro-ondas. Água inclusa no aluguel.', features: ['Mobiliada', 'Próxima à USP', 'Água inclusa', 'Wi-fi disponível'], photos: PHOTOS.kitnet },
    { title: 'Apto 3 quartos no Jardim Paulista', type: 'apartamento', price: 2200, neighborhood: 'Jardim Paulista', bedrooms: 3, bathrooms: 2, area: 85, address: 'Av. Professor João Fiúsa, 1200', desc: 'Amplo apartamento de 3 quartos na região mais valorizada de Ribeirão Preto. Suíte master, varanda gourmet, 2 vagas de garagem. Ideal para dividir entre 2-3 pessoas.', features: ['Suíte', 'Varanda gourmet', '2 vagas', 'Piscina', 'Academia'], photos: PHOTOS.sala },
    { title: 'Studio moderno na Vila Seixas', type: 'kitnet', price: 1200, neighborhood: 'Vila Seixas', bedrooms: 1, bathrooms: 1, area: 35, address: 'Rua Lafaiete, 88', desc: 'Studio moderno e recém-reformado na Vila Seixas. Conceito aberto, piso porcelanato, ar-condicionado split. A 10 min a pé do centro.', features: ['Reformado', 'Ar-condicionado', 'Porcelanato', 'Próximo ao centro'], photos: PHOTOS.kitnet },

    // Centro e região central
    { title: 'Apartamento 1 quarto no Centro', type: 'apartamento', price: 1100, neighborhood: 'Centro', bedrooms: 1, bathrooms: 1, area: 40, address: 'Rua General Osório, 320', desc: 'Apartamento compacto no coração de Ribeirão Preto. Perto de tudo: mercados, farmácias, bancos e ponto de ônibus. Prédio com elevador e portaria eletrônica.', features: ['Elevador', 'Portaria eletrônica', 'Próximo ao comércio'], photos: PHOTOS.apto },
    { title: 'Apto 2 quartos na Higienópolis', type: 'apartamento', price: 1500, neighborhood: 'Higienópolis', bedrooms: 2, bathrooms: 1, area: 58, address: 'Rua Visconde de Inhaúma, 560', desc: 'Apartamento aconchegante em prédio tradicional da Higienópolis. 2 quartos espaçosos, sala de estar e cozinha americana. Bairro tranquilo e arborizado.', features: ['Cozinha americana', 'Bairro tranquilo', 'Arborizado'], photos: PHOTOS.sala },

    // Zona Norte (mais acessível)
    { title: 'Casa 2 quartos na Vila Tibério', type: 'casa', price: 1200, neighborhood: 'Vila Tibério', bedrooms: 2, bathrooms: 1, area: 70, address: 'Rua Amador Bueno, 890', desc: 'Casa térrea na Vila Tibério com 2 quartos, sala, cozinha e quintal. Bairro com muito comércio, mercados e fácil acesso ao centro. Ideal para dividir.', features: ['Quintal', 'Comércio próximo', 'Fácil acesso'], photos: PHOTOS.casa },
    { title: 'Kitnet no Parque Industrial', type: 'kitnet', price: 700, neighborhood: 'Parque Industrial', bedrooms: 1, bathrooms: 1, area: 22, address: 'Rua Capitão Salomão, 155', desc: 'Kitnet simples e funcional no Parque Industrial. Ideal para quem busca economia. Próxima a linhas de ônibus e supermercados.', features: ['Econômico', 'Transporte próximo', 'Supermercado'], photos: PHOTOS.kitnet },
    { title: 'Apto 2 quartos no Quintino Facci', type: 'apartamento', price: 900, neighborhood: 'Quintino Facci II', bedrooms: 2, bathrooms: 1, area: 48, address: 'Rua Olavo Bilac, 230', desc: 'Apartamento econômico de 2 quartos no Quintino Facci II. Condomínio fechado com playground e churrasqueira. Ótimo para dividir entre estudantes.', features: ['Condomínio fechado', 'Playground', 'Churrasqueira'], photos: PHOTOS.apto },

    // Zona Leste
    { title: 'Apto 2 quartos na Ribeirânia', type: 'apartamento', price: 1600, neighborhood: 'Ribeirânia', bedrooms: 2, bathrooms: 1, area: 60, address: 'Av. Caramuru, 2100', desc: 'Apartamento na Ribeirânia com vista para a cidade. 2 quartos, sala grande e sacada. Região com shopping, mercados e restaurantes. Próximo à UNAERP.', features: ['Sacada', 'Próximo à UNAERP', 'Shopping próximo', 'Vista'], photos: PHOTOS.sala },
    { title: 'Casa 3 quartos no Jd. Alexandre Balbo', type: 'casa', price: 1400, neighborhood: 'Jardim Alexandre Balbo', bedrooms: 3, bathrooms: 2, area: 95, address: 'Rua Dr. Mário de Assis Moura, 440', desc: 'Casa espaçosa com 3 quartos, 2 banheiros e garagem para 2 carros. Bairro residencial e tranquilo, perto de escolas. Perfeita para república.', features: ['Garagem 2 carros', 'Bairro residencial', 'Perto de escolas'], photos: PHOTOS.casa },

    // Zona Oeste
    { title: 'Apto 1 quarto no Jd. Irajá', type: 'apartamento', price: 1300, neighborhood: 'Jardim Irajá', bedrooms: 1, bathrooms: 1, area: 42, address: 'Rua Cerqueira César, 780', desc: 'Apartamento de 1 quarto no Jardim Irajá, bairro nobre e tranquilo. Próximo ao Ribeirão Shopping. Condomínio com piscina e salão de festas.', features: ['Piscina', 'Salão de festas', 'Próximo ao shopping'], photos: PHOTOS.apto },
    { title: 'Apto 2 quartos no Jd. Califórnia', type: 'apartamento', price: 1100, neighborhood: 'Jardim Califórnia', bedrooms: 2, bathrooms: 1, area: 52, address: 'Rua Martinópolis, 350', desc: 'Apartamento de 2 quartos no Jardim Califórnia. Cozinha planejada, área de serviço. Condomínio com portaria e vaga coberta.', features: ['Cozinha planejada', 'Vaga coberta', 'Portaria'], photos: PHOTOS.apto },

    // Mais opções populares
    { title: 'Kitnet mobiliada na Lagoinha', type: 'kitnet', price: 800, neighborhood: 'Lagoinha', bedrooms: 1, bathrooms: 1, area: 25, address: 'Rua Prudente de Morais, 670', desc: 'Kitnet mobiliada e prática na Lagoinha. Próxima à rodoviária e ao centro. Cama, armário, fogão e geladeira inclusos. Ideal para quem está chegando na cidade.', features: ['Mobiliada', 'Próxima à rodoviária', 'Inclui eletrodomésticos'], photos: PHOTOS.kitnet },
    { title: 'Casa 2 quartos no Simioni', type: 'casa', price: 850, neighborhood: 'Simioni', bedrooms: 2, bathrooms: 1, area: 65, address: 'Rua Antonio Baldoni, 120', desc: 'Casa simples e confortável no Simioni. 2 quartos, sala, cozinha e área de serviço coberta. Bairro em crescimento com novos comércios.', features: ['Área de serviço', 'Bairro em crescimento'], photos: PHOTOS.casa },
    { title: 'Apto 3 quartos na Ribeirânia', type: 'apartamento', price: 2500, neighborhood: 'Ribeirânia', bedrooms: 3, bathrooms: 2, area: 90, address: 'Av. Portugal, 1800', desc: 'Excelente apartamento de 3 quartos na melhor localização da Ribeirânia. Suíte com closet, varanda, 2 vagas. Condomínio completo com lazer.', features: ['Suíte com closet', 'Varanda', '2 vagas', 'Lazer completo'], photos: PHOTOS.sala },
    { title: 'Kitnet próxima à Barão de Mauá', type: 'kitnet', price: 750, neighborhood: 'Jardim Paulista', bedrooms: 1, bathrooms: 1, area: 24, address: 'Rua Conde Afonso Celso, 290', desc: 'Kitnet ideal para estudantes da Barão de Mauá. Simples, limpa e funcional. A 3 quadras da faculdade. Água e IPTU inclusos.', features: ['Próxima à Barão de Mauá', 'Água inclusa', 'IPTU incluso'], photos: PHOTOS.kitnet },
    { title: 'Apto 2 quartos no Jd. Recreio', type: 'apartamento', price: 1000, neighborhood: 'Jardim Recreio', bedrooms: 2, bathrooms: 1, area: 50, address: 'Rua Rio de Janeiro, 420', desc: 'Apartamento acessível no Jardim Recreio. 2 quartos, cozinha e área de serviço. Condomínio com playground. Ótimo custo-benefício para dividir.', features: ['Playground', 'Econômico', 'Bom custo-benefício'], photos: PHOTOS.apto },
    { title: 'Casa grande no Monte Alegre', type: 'casa', price: 1800, neighborhood: 'Monte Alegre', bedrooms: 4, bathrooms: 2, area: 120, address: 'Rua Minas Gerais, 1050', desc: 'Casa grande com 4 quartos no Monte Alegre. Ideal para república de 3-4 pessoas. Sala espaçosa, 2 banheiros, garagem e quintal com churrasqueira.', features: ['4 quartos', 'Churrasqueira', 'Garagem', 'Quintal', 'Ideal para república'], photos: PHOTOS.casa },
    { title: 'Apto novo no Alto da Boa Vista', type: 'apartamento', price: 2800, neighborhood: 'Alto da Boa Vista', bedrooms: 3, bathrooms: 2, area: 95, address: 'Av. Professor Orlando Carlos Gegê, 600', desc: 'Apartamento novo e moderno no Alto da Boa Vista, um dos bairros mais valorizados. 3 suítes, varanda gourmet, lazer completo. Para quem quer conforto ao dividir.', features: ['3 suítes', 'Novo', 'Varanda gourmet', 'Lazer completo', 'Bairro nobre'], photos: PHOTOS.sala },
];

async function seed() {
    await mongoose.connect(MONGO);
    console.log('Conectado ao MongoDB');

    var hash = await bcrypt.hash('Morajunto@2026', 10);

    // Criar agências/proprietários
    var agencyIds = [];
    for (var ag of AGENCIES) {
        var existing = await User.findOne({ email: ag.email });
        if (existing) {
            agencyIds.push(existing._id);
            console.log('  Já existe:', ag.name);
        } else {
            var user = await User.create({
                name: ag.name,
                email: ag.email,
                password: hash,
                role: ag.role,
                phone: ag.phone,
                emailVerified: true,
                cpf: '000.000.000-' + String(rand(10, 99))
            });
            agencyIds.push(user._id);
            console.log('  Criado:', ag.name, '(' + ag.role + ')');
        }
    }

    // Criar imóveis
    var created = 0;
    for (var im of IMOVEIS) {
        var exists = await Property.findOne({ title: im.title });
        if (exists) {
            console.log('  Já existe:', im.title);
            continue;
        }

        var agencyId = agencyIds[rand(0, agencyIds.length - 1)];
        await Property.create({
            title: im.title,
            type: im.type,
            transaction: 'aluguel',
            price: im.price,
            neighborhood: im.neighborhood,
            address: im.address,
            city: 'Ribeirão Preto',
            bedrooms: im.bedrooms,
            bathrooms: im.bathrooms,
            area: im.area,
            description: im.desc,
            features: im.features,
            photos: im.photos,
            images: im.photos,
            agency: agencyId,
            status: 'active'
        });
        created++;
        console.log('  Imóvel:', im.title, '- R$' + im.price);
    }

    console.log('\n=== Seed concluído ===');
    console.log('Imóveis criados:', created);
    console.log('Agências/proprietários:', agencyIds.length);
    console.log('\nLogins criados (senha: Morajunto@2026):');
    AGENCIES.forEach(function(a) { console.log('  ' + a.email + ' (' + a.role + ')'); });

    await mongoose.disconnect();
}

seed().catch(function(e) { console.error('Erro:', e.message); process.exit(1); });
