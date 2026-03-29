// Seed: 15 anúncios reais de Ribeirão Preto
// Fonte: dados públicos QuintoAndar, OLX, ZAP Imóveis (2025/2026)
// Imagens: Unsplash (gratuitas, uso comercial permitido)

require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./backend/models/Property');
const User = require('./backend/models/User');

const UNSPLASH = 'https://images.unsplash.com/';

const properties = [
    // === KITNETS / STUDIOS (R$750-990) ===
    {
        title: 'Kitnet mobiliada no Centro - próx. ao Calçadão',
        price: 900, type: 'kitnet', transaction: 'aluguel',
        neighborhood: 'Centro', address: 'Rua Florêncio de Abreu, 450',
        bedrooms: 1, bathrooms: 1, area: 55, parking: 0,
        description: 'Kitnet mobiliada em excelente localização no centro de Ribeirão Preto, próximo ao calçadão e comércio. Ideal para estudantes e profissionais. Conta com cozinha compacta, banheiro com box e área de serviço. Prédio com portaria eletrônica.',
        features: ['Portaria eletrônica', 'Água inclusa', 'Mobiliado'],
        images: [
            UNSPLASH + 'photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1502672260266-1c1ef2d93688?w=800&h=500&fit=crop'
        ],
        views: 234
    },
    {
        title: 'Studio com varanda - Centro de Ribeirão Preto',
        price: 990, type: 'kitnet', transaction: 'aluguel',
        neighborhood: 'Centro', address: 'Rua Amador Bueno, 312',
        bedrooms: 1, bathrooms: 1, area: 52, parking: 0,
        description: 'Studio bem localizado no centro, com varanda e vista agradável. Mobiliado com cama, guarda-roupa e geladeira. Aceita pet de pequeno porte. Próximo a farmácias, supermercados e ponto de ônibus.',
        features: ['Varanda', 'Aceita pet', 'Mobiliado'],
        images: [
            UNSPLASH + 'photo-1560448204-e02f11c3d0e2?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1630699144867-37acec97df5a?w=800&h=500&fit=crop'
        ],
        views: 189
    },
    {
        title: 'Kitnet Vila Tibério - água e IPTU inclusos',
        price: 750, type: 'kitnet', transaction: 'aluguel',
        neighborhood: 'Vila Tibério', address: 'Rua Martinópolis, 88',
        bedrooms: 1, bathrooms: 1, area: 35, parking: 1,
        description: 'Kitnet no Vila Tibério com 35m² de área útil e 1 vaga de garagem. Valor do aluguel inclui água e IPTU. Bairro tradicional com fácil acesso ao centro e transporte público. Ideal para estudantes da USP e Barão de Mauá.',
        features: ['Garagem', 'Água inclusa', 'IPTU incluso'],
        images: [
            UNSPLASH + 'photo-1493809842364-78f1e9d4f0a5?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1484154218962-a197022b5858?w=800&h=500&fit=crop'
        ],
        views: 312
    },
    {
        title: 'Studio moderno Campos Elíseos - próx. faculdades',
        price: 956, type: 'kitnet', transaction: 'aluguel',
        neighborhood: 'Campos Elíseos', address: 'Rua João Penteado, 155',
        bedrooms: 1, bathrooms: 1, area: 42, parking: 0,
        description: 'Studio bem conservado em prédio com portaria. Próximo a faculdades e ao Ribeirão Shopping. Cozinha americana, banheiro com box de vidro. Ótima opção para universitários da Moura Lacerda e Barão de Mauá.',
        features: ['Portaria', 'Cozinha americana'],
        images: [
            UNSPLASH + 'photo-1536376072261-38c75010e6c9?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1507089947368-19c1da9775ae?w=800&h=500&fit=crop'
        ],
        views: 156
    },

    // === APARTAMENTOS MID-RANGE 1-2Q (R$1.250-1.800) ===
    {
        title: 'Apartamento 2 quartos Centro - Rua Florêncio de Abreu',
        price: 1250, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Centro', address: 'Rua Florêncio de Abreu, 720',
        bedrooms: 2, bathrooms: 2, area: 66, parking: 1,
        description: 'Apartamento com 2 dormitórios e varanda no coração de Ribeirão Preto. Próximo ao Teatro Pedro II, Praça XV e principais linhas de ônibus. Cozinha ampla, área de serviço e 1 vaga de garagem coberta. Condomínio com salão de festas.',
        features: ['Varanda', 'Garagem', 'Salão de festas', 'Portaria'],
        images: [
            UNSPLASH + 'photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1560185893-a55cbc8c57e8?w=800&h=500&fit=crop'
        ],
        views: 445
    },
    {
        title: 'Apto 2 dorms com piscina - Lagoinha',
        price: 1470, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Lagoinha', address: 'Rua Orlando Collucci, 290',
        bedrooms: 2, bathrooms: 1, area: 100, parking: 1,
        description: 'Apartamento espaçoso de 100m² no condomínio Parque das Oliveiras II. Condomínio com piscina, churrasqueira e playground. Aceita pet. Dois dormitórios amplos, sala com dois ambientes e cozinha planejada. Ótimo para dividir.',
        features: ['Piscina', 'Churrasqueira', 'Playground', 'Aceita pet', 'Garagem'],
        images: [
            UNSPLASH + 'photo-1574362848149-11496d93a7c7?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop'
        ],
        views: 278
    },
    {
        title: 'Apto 2 quartos Vila Seixas - região nobre',
        price: 1700, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Vila Seixas', address: 'Rua Amadeu Amaral, 480',
        bedrooms: 2, bathrooms: 2, area: 70, parking: 2,
        description: 'Apartamento em bairro nobre com 1 suíte, varanda e 2 vagas de garagem. Próximo ao Parque Raya. Vila Seixas é um dos melhores bairros da cidade, com ruas arborizadas e segurança. Ideal para dividir entre 2 pessoas.',
        features: ['Suíte', 'Varanda', '2 vagas garagem', 'Portaria'],
        images: [
            UNSPLASH + 'photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600607687939-ce8a6c25118c?w=800&h=500&fit=crop'
        ],
        views: 367
    },
    {
        title: 'Apartamento 1 quarto com closet - Nova Aliança',
        price: 1800, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Nova Aliança', address: 'Rua Arnaud Capuzzo, 155',
        bedrooms: 1, bathrooms: 1, area: 46, parking: 1,
        description: 'Apartamento moderno com suíte e closet no bairro Nova Aliança. Próximo ao Shopping Iguatemi e à Fiusa. Condomínio com academia e piscina. Ideal para jovens profissionais ou casal.',
        features: ['Suíte', 'Closet', 'Academia', 'Piscina', 'Garagem'],
        images: [
            UNSPLASH + 'photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600566753376-12c8ab7c5a0e?w=800&h=500&fit=crop'
        ],
        views: 521
    },

    // === APARTAMENTOS NICE 2-3Q (R$1.800-3.849) ===
    {
        title: 'Apto 2 quartos com suíte - Campos Elíseos',
        price: 1800, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Campos Elíseos', address: 'Rua Minoru Mizutani, 340',
        bedrooms: 2, bathrooms: 2, area: 72, parking: 1,
        description: 'Apartamento com 1 suíte e varanda em condomínio completo. Próximo a escolas, supermercados e ao acesso da Anhanguera. Sala ampla, cozinha com armários e área de serviço. Portaria 24h e piscina.',
        features: ['Suíte', 'Varanda', 'Portaria 24h', 'Piscina', 'Garagem'],
        images: [
            UNSPLASH + 'photo-1600047509807-ba8f99d2cdde?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600210492493-0946911123ea?w=800&h=500&fit=crop'
        ],
        views: 198
    },
    {
        title: 'Apto 2 quartos com piscina - Nova Aliança',
        price: 2300, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Nova Aliança', address: 'Rua Prof. Dr. Francisco Orlando Alonso, 88',
        bedrooms: 2, bathrooms: 1, area: 50, parking: 1,
        description: 'Apartamento com varanda e 2 dormitórios no bairro Nova Aliança. Condomínio completo com piscina, salão de festas e academia. Região privilegiada próxima a restaurantes e shoppings. Prédio novo com acabamento de primeira.',
        features: ['Varanda', 'Piscina', 'Academia', 'Salão de festas', 'Garagem'],
        images: [
            UNSPLASH + 'photo-1600573472591-ee6981cf81f6?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600585153490-76fb20a32601?w=800&h=500&fit=crop'
        ],
        views: 412
    },
    {
        title: 'Apto 3 quartos amplo - Centro, Rua Garibaldi',
        price: 3500, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Centro', address: 'Rua Garibaldi, 610',
        bedrooms: 3, bathrooms: 3, area: 167, parking: 2,
        description: 'Apartamento amplo e bem iluminado com 3 dormitórios no centro de Ribeirão Preto. Varanda gourmet, 2 vagas de garagem, 3 banheiros. Prédio com elevador, portaria 24h e salão de festas. Próximo ao Theatro Pedro II.',
        features: ['Varanda gourmet', 'Portaria 24h', 'Elevador', 'Salão de festas', '2 vagas'],
        images: [
            UNSPLASH + 'photo-1600607687644-aac4c3eac7f4?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600566753190-17f0baa2a6c3?w=800&h=500&fit=crop'
        ],
        views: 589
    },
    {
        title: 'Apto 4 quartos Vila Seixas - alto padrão',
        price: 3300, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Vila Seixas', address: 'Rua Campos Salles, 220',
        bedrooms: 4, bathrooms: 4, area: 132, parking: 1,
        description: 'Apartamento de alto padrão com 4 suítes no bairro Vila Seixas. Varanda ampla, armários planejados em todos os quartos. Prédio com portaria 24h, piscina e salão gourmet. Uma das regiões mais valorizadas de Ribeirão Preto. Ideal para república.',
        features: ['4 suítes', 'Armários planejados', 'Portaria 24h', 'Piscina', 'Salão gourmet'],
        images: [
            UNSPLASH + 'photo-1600585154526-990dced4db0d?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600121848594-d8644e57abab?w=800&h=500&fit=crop'
        ],
        views: 478
    },
    {
        title: 'Apto 3 suítes lazer completo - Nova Aliança',
        price: 3849, type: 'apartamento', transaction: 'aluguel',
        neighborhood: 'Nova Aliança', address: 'Rua Horácio Pessini, 75',
        bedrooms: 3, bathrooms: 3, area: 94, parking: 2,
        description: 'Apartamento com 3 dormitórios sendo 1 suíte, varanda gourmet e 2 vagas. Condomínio com lazer completo: piscina, academia, salão de festas, espaço gourmet e playground. Região da Fiusa com fácil acesso a shoppings.',
        features: ['Varanda gourmet', 'Piscina', 'Academia', 'Salão de festas', 'Playground', '2 vagas'],
        images: [
            UNSPLASH + 'photo-1600047508006-7f8b13aa3eb2?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600566752355-35792bedcfea?w=800&h=500&fit=crop'
        ],
        views: 634
    },

    // === CASAS (R$3.200-4.200) ===
    {
        title: 'Casa 5 quartos com quintal - Jardim Sumaré',
        price: 3200, type: 'casa', transaction: 'aluguel',
        neighborhood: 'Jardim Sumaré', address: 'Avenida Caramuru, 1450',
        bedrooms: 5, bathrooms: 2, area: 240, parking: 2,
        description: 'Casa ampla com varanda e quintal no tradicional Jardim Sumaré, na Avenida Caramuru. 5 dormitórios, 2 banheiros e 2 vagas de garagem. Muita iluminação natural. Perfeita para república de 4-5 estudantes da USP. Próxima ao campus.',
        features: ['Quintal', 'Varanda', '2 vagas', '5 quartos'],
        images: [
            UNSPLASH + 'photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop'
        ],
        views: 723
    },
    {
        title: 'Casa 3 suítes Alto da Boa Vista - condomínio fechado',
        price: 4200, type: 'casa', transaction: 'aluguel',
        neighborhood: 'Alto da Boa Vista', address: 'Rua Dr. Mário de Assis Moura, 310',
        bedrooms: 3, bathrooms: 3, area: 140, parking: 3,
        description: 'Casa em condomínio fechado no Alto da Boa Vista, com 3 suítes, piscina privativa e churrasqueira. 3 vagas de garagem. Condomínio com segurança 24h, área verde e playground. Um dos bairros mais seguros e valorizados de RP.',
        features: ['Condomínio fechado', 'Piscina privativa', 'Churrasqueira', '3 suítes', 'Segurança 24h', '3 vagas'],
        images: [
            UNSPLASH + 'photo-1600573472591-ee6981cf81f6?w=800&h=500&fit=crop',
            UNSPLASH + 'photo-1600210492486-724fe5c67fb0?w=800&h=500&fit=crop'
        ],
        views: 856
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB conectado');

        // Find admin user to be the "agency" for all properties
        var admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.error('Admin user not found. Run: curl -X POST http://localhost:3000/api/auth/admin/seed');
            process.exit(1);
        }

        // Delete ALL existing properties
        var deleted = await Property.deleteMany({});
        console.log('Deletados:', deleted.deletedCount, 'imóveis antigos');

        // Insert new properties
        var created = 0;
        for (var p of properties) {
            await Property.create({
                ...p,
                city: 'Ribeirão Preto',
                agency: admin._id,
                status: 'active'
            });
            created++;
            console.log('  +', p.title, '- R$', p.price);
        }

        console.log('\n' + created + ' imóveis reais de Ribeirão Preto inseridos!');
        console.log('Acesse http://localhost:3000 para ver os anúncios.');
        process.exit(0);
    } catch (e) {
        console.error('Erro:', e.message);
        process.exit(1);
    }
}

seed();
