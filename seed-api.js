// Seed via API — garante UTF-8 correto
const API = 'http://localhost:3000/api';

// Fotos de alta qualidade - interiores de apartamento (Unsplash, uso livre)
const IMG = {
    // Salas modernas
    sala1: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=500&fit=crop',
    sala2: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=500&fit=crop',
    sala3: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=500&fit=crop',
    sala4: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&h=500&fit=crop',
    // Quartos
    quarto1: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&h=500&fit=crop',
    quarto2: 'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&h=500&fit=crop',
    quarto3: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&h=500&fit=crop',
    // Cozinhas
    coz1: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=500&fit=crop',
    coz2: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&h=500&fit=crop',
    // Banheiros
    ban1: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&h=500&fit=crop',
    // Fachadas bonitas
    fach1: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop',
    fach2: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800&h=500&fit=crop',
    // Casas
    casa1: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=500&fit=crop',
    casa2: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=500&fit=crop',
    // Varanda/Piscina
    var1: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=500&fit=crop',
    pisc1: 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=800&h=500&fit=crop',
};

const properties = [
    {
        title: 'Kitnet mobiliada no Centro - prox. ao Calcadao',
        price: 900, type: 'kitnet', neighborhood: 'Centro',
        address: 'Rua Florencio de Abreu, 450',
        bedrooms: 1, bathrooms: 1, area: 55,
        description: 'Kitnet mobiliada em excelente localizacao no centro de Ribeirao Preto, proximo ao calcadao e comercio. Ideal para estudantes e profissionais. Portaria eletronica.',
        features: ['Portaria eletronica', 'Agua inclusa', 'Mobiliado'],
        images: [IMG.sala3, IMG.coz1]
    },
    {
        title: 'Studio com varanda - Centro de Ribeirao Preto',
        price: 990, type: 'kitnet', neighborhood: 'Centro',
        address: 'Rua Amador Bueno, 312',
        bedrooms: 1, bathrooms: 1, area: 52,
        description: 'Studio bem localizado no centro, com varanda e vista agradavel. Mobiliado com cama, guarda-roupa e geladeira. Aceita pet de pequeno porte.',
        features: ['Varanda', 'Aceita pet', 'Mobiliado'],
        images: [IMG.quarto1, IMG.sala4]
    },
    {
        title: 'Kitnet Vila Tiberio - agua e IPTU inclusos',
        price: 750, type: 'kitnet', neighborhood: 'Vila Tibério',
        address: 'Rua Martinopolis, 88',
        bedrooms: 1, bathrooms: 1, area: 35,
        description: 'Kitnet no Vila Tiberio com 35m2. Aluguel inclui agua e IPTU. Bairro tradicional com facil acesso ao centro. Ideal para estudantes da USP e Barao de Maua.',
        features: ['Garagem', 'Agua inclusa', 'IPTU incluso'],
        images: [IMG.quarto3, IMG.coz2]
    },
    {
        title: 'Studio moderno Campos Eliseos - prox. faculdades',
        price: 956, type: 'kitnet', neighborhood: 'Campos Elíseos',
        address: 'Rua Joao Penteado, 155',
        bedrooms: 1, bathrooms: 1, area: 42,
        description: 'Studio em predio com portaria. Proximo a faculdades e ao Ribeirao Shopping. Cozinha americana, banheiro com box de vidro.',
        features: ['Portaria', 'Cozinha americana'],
        images: [IMG.sala2, IMG.ban1]
    },
    {
        title: 'Apartamento 2 quartos Centro - varanda e garagem',
        price: 1250, type: 'apartamento', neighborhood: 'Centro',
        address: 'Rua Florencio de Abreu, 720',
        bedrooms: 2, bathrooms: 2, area: 66, parking: 1,
        description: 'Apartamento com 2 dormitorios e varanda no coracao de Ribeirao Preto. Proximo ao Teatro Pedro II e Praca XV. Cozinha ampla, area de servico e 1 vaga de garagem coberta.',
        features: ['Varanda', 'Garagem', 'Salao de festas', 'Portaria'],
        images: [IMG.sala1, IMG.quarto2]
    },
    {
        title: 'Apto 2 dorms com piscina - Lagoinha',
        price: 1470, type: 'apartamento', neighborhood: 'Lagoinha',
        address: 'Rua Orlando Collucci, 290',
        bedrooms: 2, bathrooms: 1, area: 100, parking: 1,
        description: 'Apartamento espacoso de 100m2 no condominio Parque das Oliveiras II. Piscina, churrasqueira e playground. Aceita pet. Dois dormitorios amplos, sala com dois ambientes e cozinha planejada.',
        features: ['Piscina', 'Churrasqueira', 'Playground', 'Aceita pet', 'Garagem'],
        images: [IMG.fach2, IMG.pisc1]
    },
    {
        title: 'Apto 2 quartos Vila Seixas - regiao nobre',
        price: 1700, type: 'apartamento', neighborhood: 'Vila Seixas',
        address: 'Rua Amadeu Amaral, 480',
        bedrooms: 2, bathrooms: 2, area: 70, parking: 2,
        description: 'Apartamento em bairro nobre com 1 suite, varanda e 2 vagas. Proximo ao Parque Raya. Vila Seixas e um dos melhores bairros, com ruas arborizadas e seguranca.',
        features: ['Suite', 'Varanda', '2 vagas garagem', 'Portaria'],
        images: [IMG.var1, IMG.sala1]
    },
    {
        title: 'Apartamento 1 quarto com closet - Nova Alianca',
        price: 1800, type: 'apartamento', neighborhood: 'Nova Aliança',
        address: 'Rua Arnaud Capuzzo, 155',
        bedrooms: 1, bathrooms: 1, area: 46, parking: 1,
        description: 'Apartamento moderno com suite e closet no bairro Nova Alianca. Proximo ao Shopping Iguatemi e a Fiusa. Condominio com academia e piscina. Ideal para jovens profissionais.',
        features: ['Suite', 'Closet', 'Academia', 'Piscina', 'Garagem'],
        images: [IMG.quarto2, IMG.sala2]
    },
    {
        title: 'Apto 2 quartos com suite - Campos Eliseos',
        price: 1800, type: 'apartamento', neighborhood: 'Campos Elíseos',
        address: 'Rua Minoru Mizutani, 340',
        bedrooms: 2, bathrooms: 2, area: 72, parking: 1,
        description: 'Apartamento com 1 suite e varanda em condominio completo. Proximo a escolas e ao acesso da Anhanguera. Sala ampla, cozinha com armarios. Portaria 24h e piscina.',
        features: ['Suite', 'Varanda', 'Portaria 24h', 'Piscina', 'Garagem'],
        images: [IMG.sala4, IMG.coz2]
    },
    {
        title: 'Apto 2 quartos com piscina - Nova Alianca',
        price: 2300, type: 'apartamento', neighborhood: 'Nova Aliança',
        address: 'Rua Prof. Dr. Francisco Orlando Alonso, 88',
        bedrooms: 2, bathrooms: 1, area: 50, parking: 1,
        description: 'Apartamento com varanda e 2 dormitorios no bairro Nova Alianca. Condominio completo com piscina, salao de festas e academia. Regiao privilegiada proxima a restaurantes e shoppings.',
        features: ['Varanda', 'Piscina', 'Academia', 'Salao de festas', 'Garagem'],
        images: [IMG.fach1, IMG.pisc1]
    },
    {
        title: 'Apto 3 quartos amplo - Centro, Rua Garibaldi',
        price: 3500, type: 'apartamento', neighborhood: 'Centro',
        address: 'Rua Garibaldi, 610',
        bedrooms: 3, bathrooms: 3, area: 167, parking: 2,
        description: 'Apartamento amplo com 3 dormitorios no centro. Varanda gourmet, 2 vagas de garagem, 3 banheiros. Predio com elevador, portaria 24h e salao de festas. Proximo ao Theatro Pedro II.',
        features: ['Varanda gourmet', 'Portaria 24h', 'Elevador', 'Salao de festas', '2 vagas'],
        images: [IMG.sala1, IMG.coz1]
    },
    {
        title: 'Apto 4 quartos Vila Seixas - alto padrao',
        price: 3300, type: 'apartamento', neighborhood: 'Vila Seixas',
        address: 'Rua Campos Salles, 220',
        bedrooms: 4, bathrooms: 4, area: 132, parking: 1,
        description: 'Apartamento de alto padrao com 4 suites na Vila Seixas. Varanda ampla, armarios planejados. Portaria 24h, piscina e salao gourmet. Ideal para republica de 4 pessoas.',
        features: ['4 suites', 'Armarios planejados', 'Portaria 24h', 'Piscina', 'Salao gourmet'],
        images: [IMG.quarto1, IMG.sala3]
    },
    {
        title: 'Apto 3 suites lazer completo - Nova Alianca',
        price: 3849, type: 'apartamento', neighborhood: 'Nova Aliança',
        address: 'Rua Horacio Pessini, 75',
        bedrooms: 3, bathrooms: 3, area: 94, parking: 2,
        description: 'Apartamento com 3 dormitorios sendo 1 suite, varanda gourmet e 2 vagas. Lazer completo: piscina, academia, salao de festas, espaco gourmet e playground. Regiao da Fiusa.',
        features: ['Varanda gourmet', 'Piscina', 'Academia', 'Salao de festas', 'Playground', '2 vagas'],
        images: [IMG.var1, IMG.quarto3]
    },
    {
        title: 'Casa 5 quartos com quintal - Jardim Sumare',
        price: 3200, type: 'casa', neighborhood: 'Jardim Sumaré',
        address: 'Avenida Caramuru, 1450',
        bedrooms: 5, bathrooms: 2, area: 240, parking: 2,
        description: 'Casa ampla com varanda e quintal no Jardim Sumare. 5 dormitorios, 2 banheiros e 2 vagas. Muita iluminacao natural. Perfeita para republica de 4-5 estudantes da USP.',
        features: ['Quintal', 'Varanda', '2 vagas', '5 quartos'],
        images: [IMG.casa1, IMG.sala4]
    },
    {
        title: 'Casa 3 suites Alto da Boa Vista - condominio fechado',
        price: 4200, type: 'casa', neighborhood: 'Alto da Boa Vista',
        address: 'Rua Dr. Mario de Assis Moura, 310',
        bedrooms: 3, bathrooms: 3, area: 140, parking: 3,
        description: 'Casa em condominio fechado no Alto da Boa Vista, com 3 suites, piscina privativa e churrasqueira. 3 vagas. Seguranca 24h, area verde e playground. Um dos bairros mais seguros de RP.',
        features: ['Condominio fechado', 'Piscina privativa', 'Churrasqueira', '3 suites', 'Seguranca 24h'],
        images: [IMG.casa2, IMG.pisc1]
    }
];

async function seed() {
    // Login
    let res = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'thalis132008@gmail.com', password: 'Admin@123' })
    });
    let data = await res.json();
    let token = data.token;
    console.log('Logged in as admin');

    // Insert all
    let ok = 0;
    for (let p of properties) {
        let r = await fetch(API + '/owner/properties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(p)
        });
        let d = await r.json();
        if (d.property) {
            ok++;
            console.log('  + ' + d.property.title + ' - R$' + d.property.price);
        } else {
            console.log('  ERRO: ' + (d.error || JSON.stringify(d)));
        }
    }
    console.log('\n' + ok + '/15 imoveis inseridos com sucesso!');
}

seed().catch(e => console.error(e));
