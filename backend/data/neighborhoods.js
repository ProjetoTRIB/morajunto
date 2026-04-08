// ===== DICIONÁRIO COMPLETO DE BAIRROS — RIBEIRÃO PRETO =====
// Fonte: QuintoAndar, ZAP, MySide, CRECISP (2025/2026)
// Usado para SEO (SSR), sitemap, e structured data

var BEDROOM_MULTIPLIER = { 1: 0.72, 2: 1.0, 3: 1.52, 4: 2.1 };
var CITY_AVG_2Q = 1800;

var BAIRROS = {
    // ===== CENTRO E REGIÃO CENTRAL =====
    'centro': {
        name: 'Centro',
        zone: 'Centro e Região Central',
        tier: 'medio',
        avg2q: 1500, min: 800, max: 3500,
        unis: ['Barão de Mauá', 'Moura Lacerda'],
        desc: 'região central com fácil acesso a transporte, comércio e serviços',
        longDesc: 'O Centro de Ribeirão Preto concentra a maior oferta de comércio, serviços e transporte público da cidade. Com aluguéis a partir de R$ 800, é uma opção prática para quem estuda na Barão de Mauá ou Moura Lacerda e quer morar perto de tudo sem depender de carro.',
        related: ['vila-seixas', 'higienopolis', 'republica', 'vila-virginia']
    },
    'vila-seixas': {
        name: 'Vila Seixas',
        zone: 'Centro e Região Central',
        tier: 'medio',
        avg2q: 2000, min: 1000, max: 4500,
        unis: ['UNAERP'],
        desc: 'bairro residencial nobre próximo ao centro e à UNAERP',
        longDesc: 'A Vila Seixas é um dos bairros mais tradicionais de Ribeirão Preto, com ruas arborizadas e imóveis de alto padrão. Próximo ao centro e à UNAERP, oferece qualidade de vida com fácil acesso a restaurantes, clínicas e o Teatro Pedro II.',
        related: ['centro', 'higienopolis', 'jardim-sumare', 'republica']
    },
    'higienopolis': {
        name: 'Higienópolis',
        zone: 'Centro e Região Central',
        tier: 'medio',
        avg2q: 1800, min: 900, max: 4200,
        unis: [],
        desc: 'bairro tradicional com boa infraestrutura e proximidade ao centro',
        longDesc: 'Higienópolis é um bairro consolidado entre o Centro e a Zona Sul, com ampla oferta de comércio local, padarias e farmácias. Ideal para quem busca o equilíbrio entre tranquilidade residencial e acesso rápido ao centro da cidade.',
        related: ['centro', 'vila-seixas', 'jardim-sumare', 'republica']
    },
    'republica': {
        name: 'República',
        zone: 'Centro e Região Central',
        tier: 'medio',
        avg2q: 1500, min: 750, max: 3500,
        unis: [],
        desc: 'bairro próximo ao centro com opções acessíveis de moradia',
        longDesc: 'O bairro República fica colado ao Centro e oferece aluguéis mais em conta que os bairros vizinhos. Com boa conectividade de ônibus e comércio variado, é uma escolha prática para quem trabalha ou estuda na região central de Ribeirão Preto.',
        related: ['centro', 'vila-seixas', 'higienopolis', 'vila-virginia']
    },
    'vila-virginia': {
        name: 'Vila Virgínia',
        zone: 'Centro e Região Central',
        tier: 'medio',
        avg2q: 1500, min: 750, max: 3500,
        unis: [],
        desc: 'bairro com aluguéis econômicos e boa conectividade de ônibus',
        longDesc: 'A Vila Virgínia oferece uma das melhores relações custo-benefício da região central. Com diversas linhas de ônibus, supermercados e escolas, é um bairro residencial tranquilo ideal para quem quer economizar no aluguel sem ficar longe do centro.',
        related: ['centro', 'republica', 'ipiranga', 'lagoinha']
    },

    // ===== ZONA SUL =====
    'jardim-sumare': {
        name: 'Jardim Sumaré',
        zone: 'Zona Sul',
        tier: 'nobre',
        avg2q: 2200, min: 1000, max: 5200,
        unis: ['USP-RP'],
        desc: 'bairro nobre próximo à USP e ao Shopping Santa Úrsula',
        longDesc: 'O Jardim Sumaré é um dos bairros mais valorizados de Ribeirão Preto, com infraestrutura completa, ruas arborizadas e proximidade à USP. Muito procurado por estudantes e profissionais que buscam qualidade de vida, conta com o Shopping Santa Úrsula e diversos restaurantes na região.',
        related: ['jardim-paulista', 'jardim-iraja', 'city-ribeirao', 'jardim-botanico']
    },
    'jardim-paulista': {
        name: 'Jardim Paulista',
        zone: 'Zona Sul',
        tier: 'medio',
        avg2q: 1700, min: 850, max: 4000,
        unis: ['USP-RP', 'Barão de Mauá'],
        desc: 'bairro residencial com bom custo-benefício e acesso à USP',
        longDesc: 'O Jardim Paulista oferece excelente custo-benefício para quem estuda na USP ou Barão de Mauá. Com supermercados, academias e fácil acesso à Zona Sul, é um bairro residencial tranquilo com aluguéis mais acessíveis que seus vizinhos nobres.',
        related: ['jardim-sumare', 'jardim-iraja', 'jardim-macedo', 'jardim-america']
    },
    'jardim-iraja': {
        name: 'Jardim Irajá',
        zone: 'Zona Sul',
        tier: 'medio',
        avg2q: 1900, min: 900, max: 4500,
        unis: ['Estácio', 'UNAERP'],
        desc: 'bairro valorizado próximo a universidades e ao Ribeirão Shopping',
        longDesc: 'O Jardim Irajá é estratégico para quem estuda na Estácio ou UNAERP, com fácil acesso ao Ribeirão Shopping e à Fiusa. Bairro em constante valorização, combina uma boa oferta de apartamentos para dividir com uma vida noturna e gastronômica vibrante na região.',
        related: ['jardim-sumare', 'jardim-paulista', 'jardim-macedo', 'ribeirania']
    },
    'jardim-macedo': {
        name: 'Jardim Macedo',
        zone: 'Zona Sul',
        tier: 'medio',
        avg2q: 1600, min: 800, max: 3800,
        unis: [],
        desc: 'bairro residencial com comércio local e aluguéis moderados',
        longDesc: 'O Jardim Macedo é uma opção equilibrada na Zona Sul, com aluguéis mais acessíveis que Sumaré e Irajá. Conta com comércio local variado, padarias e está a poucos minutos do Ribeirão Shopping, oferecendo praticidade para o dia a dia.',
        related: ['jardim-paulista', 'jardim-iraja', 'jardim-america', 'jardim-independencia']
    },
    'jardim-america': {
        name: 'Jardim América',
        zone: 'Zona Sul',
        tier: 'medio',
        avg2q: 1600, min: 800, max: 3800,
        unis: [],
        desc: 'bairro familiar com boa infraestrutura e áreas verdes',
        longDesc: 'O Jardim América é um bairro familiar e bem estruturado na Zona Sul de Ribeirão Preto. Com praças, escolas e supermercados próximos, atrai famílias e jovens profissionais que buscam tranquilidade sem abrir mão da infraestrutura urbana.',
        related: ['jardim-macedo', 'jardim-independencia', 'jardim-paulista', 'jardim-sumare']
    },
    'jardim-independencia': {
        name: 'Jardim Independência',
        zone: 'Zona Sul',
        tier: 'medio',
        avg2q: 1700, min: 850, max: 4000,
        unis: [],
        desc: 'bairro residencial bem localizado na Zona Sul',
        longDesc: 'O Jardim Independência combina localização estratégica na Zona Sul com preços moderados. Próximo a shoppings e avenidas principais, é um bairro que cresce em oferta de apartamentos, ideal para quem quer dividir aluguel na região mais valorizada da cidade.',
        related: ['jardim-america', 'jardim-macedo', 'jardim-paulista', 'jardim-botanico']
    },
    'jardim-botanico': {
        name: 'Jardim Botânico',
        zone: 'Zona Sul',
        tier: 'nobre',
        avg2q: 2500, min: 1200, max: 6000,
        unis: [],
        desc: 'bairro tranquilo e arborizado, próximo ao campus da USP',
        longDesc: 'O Jardim Botânico é um dos bairros mais nobres e tranquilos de Ribeirão Preto. Com ruas largas, muito verde e condomínios de alto padrão, está próximo ao campus da USP e oferece uma experiência de moradia premium para quem valoriza sossego e natureza.',
        related: ['jardim-sumare', 'alto-da-boa-vista', 'jardim-california', 'city-ribeirao']
    },
    'city-ribeirao': {
        name: 'City Ribeirão',
        zone: 'Zona Sul',
        tier: 'nobre',
        avg2q: 2300, min: 1060, max: 5500,
        unis: [],
        desc: 'condomínio residencial de alto padrão na Zona Sul',
        longDesc: 'O City Ribeirão é um dos endereços mais exclusivos da cidade, com condomínios fechados e infraestrutura de lazer completa. Localizado na Zona Sul, atrai famílias e profissionais que buscam segurança, espaço e qualidade de vida em um ambiente planejado.',
        related: ['bonfim-paulista', 'jardim-botanico', 'jardim-sumare', 'alto-da-boa-vista']
    },
    'bonfim-paulista': {
        name: 'Bonfim Paulista',
        zone: 'Zona Sul',
        tier: 'nobre',
        avg2q: 2500, min: 1200, max: 6000,
        unis: [],
        desc: 'distrito residencial com condomínios de luxo e área verde',
        longDesc: 'Bonfim Paulista é um distrito ao sul de Ribeirão Preto conhecido por seus condomínios de alto padrão cercados de natureza. Perfeito para quem busca casas espaçosas em condomínios fechados, com acesso rápido à cidade pela rodovia Anhanguera.',
        related: ['city-ribeirao', 'jardim-botanico', 'jardim-sumare', 'alto-da-boa-vista']
    },

    // ===== ZONA OESTE =====
    'nova-alianca': {
        name: 'Nova Aliança',
        zone: 'Zona Oeste',
        tier: 'nobre',
        avg2q: 2300, min: 1060, max: 5500,
        unis: ['UNIP'],
        desc: 'bairro moderno próximo ao Barão de Mauá e ao Shopping Iguatemi',
        longDesc: 'Nova Aliança é um dos bairros que mais crescem em Ribeirão Preto, com prédios modernos, o Shopping Iguatemi e a UNIP nas proximidades. Atrai jovens profissionais e estudantes que buscam infraestrutura de ponta com opções de lazer, gastronomia e compras.',
        related: ['jardim-nova-alianca-sul', 'alto-da-boa-vista', 'jardim-california', 'jardim-canada']
    },
    'jardim-nova-alianca-sul': {
        name: 'Jardim Nova Aliança Sul',
        zone: 'Zona Oeste',
        tier: 'medio',
        avg2q: 1800, min: 900, max: 4500,
        unis: ['UNIP'],
        desc: 'extensão de Nova Aliança com opções mais acessíveis',
        longDesc: 'O Jardim Nova Aliança Sul é a continuação natural do Nova Aliança, com imóveis mais novos e preços ligeiramente mais acessíveis. Próximo à UNIP e ao Shopping Iguatemi, combina modernidade com um custo-benefício atrativo para quem quer morar na Zona Oeste.',
        related: ['nova-alianca', 'jardim-california', 'alto-da-boa-vista', 'jardim-santa-angela']
    },
    'alto-da-boa-vista': {
        name: 'Alto da Boa Vista',
        zone: 'Zona Oeste',
        tier: 'nobre',
        avg2q: 2400, min: 1100, max: 5800,
        unis: [],
        desc: 'região residencial valorizada com excelente infraestrutura',
        longDesc: 'O Alto da Boa Vista é um dos bairros mais valorizados da Zona Oeste, com vista privilegiada e condomínios de alto padrão. A infraestrutura completa inclui escolas particulares, clínicas e fácil acesso ao Shopping Iguatemi, atraindo famílias e executivos.',
        related: ['nova-alianca', 'jardim-california', 'jardim-botanico', 'jardim-canada']
    },
    'jardim-california': {
        name: 'Jardim Califórnia',
        zone: 'Zona Oeste',
        tier: 'nobre',
        avg2q: 2100, min: 1000, max: 5000,
        unis: ['UNAERP', 'Estácio'],
        desc: 'bairro nobre com acesso a universidades e ao Shopping Iguatemi',
        longDesc: 'O Jardim Califórnia é um bairro nobre da Zona Oeste, com ruas tranquilas e excelente infraestrutura. Próximo à UNAERP, Estácio e ao Shopping Iguatemi, é procurado por estudantes universitários que buscam moradia de qualidade na região.',
        related: ['nova-alianca', 'alto-da-boa-vista', 'jardim-nova-alianca-sul', 'jardim-santa-angela']
    },
    'jardim-canada': {
        name: 'Jardim Canadá',
        zone: 'Zona Oeste',
        tier: 'nobre',
        avg2q: 2200, min: 1000, max: 5200,
        unis: ['UNIP'],
        desc: 'bairro planejado com condomínios modernos na Zona Oeste',
        longDesc: 'O Jardim Canadá é um bairro planejado com condomínios horizontais e verticais de alto padrão. Localizado na Zona Oeste próximo à UNIP, combina segurança, áreas verdes e infraestrutura moderna para quem busca qualidade de vida.',
        related: ['nova-alianca', 'jardim-santa-angela', 'jardim-california', 'alto-da-boa-vista']
    },
    'jardim-santa-angela': {
        name: 'Jardim Santa Ângela',
        zone: 'Zona Oeste',
        tier: 'nobre',
        avg2q: 2100, min: 1000, max: 5000,
        unis: [],
        desc: 'bairro residencial nobre com condomínios fechados',
        longDesc: 'O Jardim Santa Ângela é um bairro residencial de alto padrão na Zona Oeste, marcado por condomínios fechados e ruas tranquilas. Próximo ao Shopping Iguatemi e com fácil acesso às principais avenidas, oferece segurança e conforto para famílias.',
        related: ['jardim-canada', 'nova-alianca', 'jardim-california', 'alto-da-boa-vista']
    },
    'guapore': {
        name: 'Guaporé',
        zone: 'Zona Oeste',
        tier: 'medio',
        avg2q: 1400, min: 700, max: 3200,
        unis: [],
        desc: 'bairro com aluguéis acessíveis na Zona Oeste',
        longDesc: 'O Guaporé é uma opção acessível na Zona Oeste de Ribeirão Preto, com comércio local e linhas de ônibus que conectam ao centro. Ideal para quem quer morar na região oeste gastando menos, com supermercados e escolas nas proximidades.',
        related: ['lagoinha', 'ipiranga', 'nova-alianca', 'jardim-nova-alianca-sul']
    },
    'lagoinha': {
        name: 'Lagoinha',
        zone: 'Zona Oeste',
        tier: 'popular',
        avg2q: 1400, min: 700, max: 3000,
        unis: ['UNIP'],
        desc: 'região popular com aluguéis acessíveis e boa oferta de transporte',
        longDesc: 'A Lagoinha é um dos bairros mais acessíveis da Zona Oeste, com forte comércio popular e diversas linhas de ônibus. Próximo à UNIP, é uma escolha econômica para estudantes e trabalhadores que precisam de mobilidade e custo baixo de moradia.',
        related: ['guapore', 'ipiranga', 'vila-virginia', 'vila-tiberio']
    },
    'ipiranga': {
        name: 'Ipiranga',
        zone: 'Zona Oeste',
        tier: 'popular',
        avg2q: 1250, min: 650, max: 2600,
        unis: [],
        desc: 'bairro central com ampla oferta de comércio e serviços',
        longDesc: 'O Ipiranga é um bairro popular e bem conectado, com comércio diversificado e fácil acesso ao centro de Ribeirão Preto. Com aluguéis entre os mais acessíveis da cidade, é ideal para quem busca economia sem abrir mão de infraestrutura básica.',
        related: ['lagoinha', 'guapore', 'vila-virginia', 'centro']
    },

    // ===== ZONA NORTE =====
    'campos-eliseos': {
        name: 'Campos Elíseos',
        zone: 'Zona Norte',
        tier: 'popular',
        avg2q: 1400, min: 700, max: 3200,
        unis: ['Barão de Mauá', 'Moura Lacerda', 'USP-RP'],
        desc: 'região com muitos estudantes e repúblicas próximas à USP',
        longDesc: 'Campos Elíseos é o bairro universitário por excelência de Ribeirão Preto. Com a maior concentração de repúblicas da cidade, está próximo à USP, Barão de Mauá e Moura Lacerda. Aluguéis acessíveis e vida noturna agitada fazem dele o destino favorito dos estudantes.',
        related: ['vila-tiberio', 'jardim-antartica', 'jardim-paiva', 'parque-industrial']
    },
    'vila-tiberio': {
        name: 'Vila Tibério',
        zone: 'Zona Norte',
        tier: 'popular',
        avg2q: 1300, min: 700, max: 2800,
        unis: ['USP-RP', 'Barão de Mauá', 'Moura Lacerda'],
        desc: 'bairro tradicional com comércio forte e acesso rápido ao centro',
        longDesc: 'A Vila Tibério é um dos bairros mais tradicionais de Ribeirão Preto, com forte identidade cultural e comércio variado. Próximo ao centro e a universidades como USP, Barão de Mauá e Moura Lacerda, oferece aluguéis populares e uma atmosfera de bairro autêntico.',
        related: ['campos-eliseos', 'centro', 'parque-industrial', 'jardim-antartica']
    },
    'parque-industrial': {
        name: 'Parque Industrial',
        zone: 'Zona Norte',
        tier: 'popular',
        avg2q: 1200, min: 600, max: 2500,
        unis: [],
        desc: 'bairro com os aluguéis mais acessíveis da Zona Norte',
        longDesc: 'O Parque Industrial oferece os aluguéis mais baixos da Zona Norte, sendo uma opção econômica para quem precisa morar em Ribeirão Preto gastando pouco. Com comércio básico e linhas de ônibus, atende quem prioriza economia no custo de moradia.',
        related: ['campos-eliseos', 'vila-tiberio', 'simioni', 'jardim-antartica']
    },
    'jardim-antartica': {
        name: 'Jardim Antártica',
        zone: 'Zona Norte',
        tier: 'medio',
        avg2q: 1400, min: 700, max: 3200,
        unis: [],
        desc: 'bairro residencial com comércio local na Zona Norte',
        longDesc: 'O Jardim Antártica é um bairro residencial da Zona Norte com infraestrutura de comércio local e aluguéis moderados. Bem conectado por ônibus, oferece uma opção tranquila para quem trabalha na região norte ou no distrito industrial da cidade.',
        related: ['campos-eliseos', 'jardim-paiva', 'vila-tiberio', 'jardim-piratininga']
    },
    'jardim-paiva': {
        name: 'Jardim Paiva',
        zone: 'Zona Norte',
        tier: 'medio',
        avg2q: 1350, min: 680, max: 3000,
        unis: [],
        desc: 'bairro residencial calmo com aluguéis moderados',
        longDesc: 'O Jardim Paiva é um bairro residencial calmo na Zona Norte de Ribeirão Preto. Com ruas tranquilas e comércio essencial, oferece aluguéis moderados e é uma boa opção para quem busca sossego sem se distanciar muito do centro da cidade.',
        related: ['jardim-antartica', 'campos-eliseos', 'vila-abranches', 'jardim-piratininga']
    },
    'vila-abranches': {
        name: 'Vila Abranches',
        zone: 'Zona Norte',
        tier: 'medio',
        avg2q: 1350, min: 680, max: 3000,
        unis: [],
        desc: 'bairro tranquilo com acesso à rodovia e ao centro',
        longDesc: 'A Vila Abranches é um bairro residencial da Zona Norte com fácil acesso à rodovia Anhanguera e ao centro. Oferece um ambiente tranquilo com aluguéis moderados, sendo procurado por quem trabalha no distrito industrial ou precisa de mobilidade rodoviária.',
        related: ['jardim-paiva', 'jardim-antartica', 'campos-eliseos', 'quintino-facci-ii']
    },
    'quintino-facci-ii': {
        name: 'Quintino Facci II',
        zone: 'Zona Norte',
        tier: 'popular',
        avg2q: 1100, min: 550, max: 2200,
        unis: [],
        desc: 'bairro econômico na Zona Norte com aluguéis acessíveis',
        longDesc: 'O Quintino Facci II é um dos bairros mais econômicos de Ribeirão Preto, ideal para quem busca aluguel barato na Zona Norte. Com comércio básico e linhas de ônibus, atende trabalhadores e estudantes que priorizam economia no custo de vida.',
        related: ['simioni', 'parque-industrial', 'jardim-piratininga', 'adelino-simioni']
    },
    'jardim-piratininga': {
        name: 'Jardim Piratininga',
        zone: 'Zona Norte',
        tier: 'medio',
        avg2q: 1300, min: 650, max: 2800,
        unis: [],
        desc: 'bairro residencial com infraestrutura em crescimento',
        longDesc: 'O Jardim Piratininga é um bairro em crescimento na Zona Norte, com novos empreendimentos e infraestrutura em expansão. Oferece aluguéis competitivos e está se tornando uma alternativa atrativa para quem busca imóveis mais novos na região.',
        related: ['jardim-antartica', 'jardim-paiva', 'campos-eliseos', 'quintino-facci-ii']
    },
    'simioni': {
        name: 'Simioni',
        zone: 'Zona Norte',
        tier: 'popular',
        avg2q: 1100, min: 550, max: 2200,
        unis: [],
        desc: 'bairro popular com aluguéis entre os mais baixos da cidade',
        longDesc: 'O Simioni é um bairro popular na Zona Norte com aluguéis entre os mais baixos de Ribeirão Preto. Com comércio de bairro e acesso por ônibus, é procurado por quem precisa de moradia econômica e não se importa em estar mais distante do centro.',
        related: ['quintino-facci-ii', 'adelino-simioni', 'parque-industrial', 'avelino-alves-palma']
    },
    'avelino-alves-palma': {
        name: 'Avelino Alves Palma',
        zone: 'Zona Norte',
        tier: 'popular',
        avg2q: 1050, min: 500, max: 2100,
        unis: [],
        desc: 'bairro com os aluguéis mais econômicos da cidade',
        longDesc: 'O Avelino Alves Palma oferece os aluguéis mais econômicos de Ribeirão Preto, a partir de R$ 500. É uma opção para quem precisa de moradia com custo mínimo na Zona Norte, com acesso a comércio básico e transporte público para o centro.',
        related: ['simioni', 'adelino-simioni', 'quintino-facci-ii', 'parque-industrial']
    },

    // ===== ZONA LESTE =====
    'ribeirania': {
        name: 'Ribeirânia',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1800, min: 900, max: 4500,
        unis: ['UNAERP', 'Estácio'],
        desc: 'bairro nobre com boa infraestrutura e próximo ao Shopping Iguatemi',
        longDesc: 'Ribeirânia é um dos bairros mais completos da Zona Leste, com infraestrutura de saúde, educação e lazer. Próximo à UNAERP, Estácio e ao Shopping Iguatemi, combina localização privilegiada com uma variedade de imóveis para todos os perfis.',
        related: ['jardim-luiza', 'jardim-recreio', 'castelo-branco', 'jardim-iraja']
    },
    'jardim-luiza': {
        name: 'Jardim Luiza',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1500, min: 750, max: 3500,
        unis: [],
        desc: 'bairro residencial com bom custo-benefício na Zona Leste',
        longDesc: 'O Jardim Luiza é um bairro residencial da Zona Leste com aluguéis moderados e boa infraestrutura de bairro. Com supermercados, escolas e praças, oferece um ambiente familiar e tranquilo, a poucos minutos de Ribeirânia e do Shopping Iguatemi.',
        related: ['ribeirania', 'jardim-recreio', 'castelo-branco', 'jardim-alexandre-balbo']
    },
    'jardim-recreio': {
        name: 'Jardim Recreio',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1500, min: 750, max: 3500,
        unis: [],
        desc: 'bairro familiar com áreas de lazer na Zona Leste',
        longDesc: 'O Jardim Recreio é um bairro residencial com boa oferta de áreas verdes e espaços de lazer na Zona Leste. Com preços moderados e ambiente familiar, é uma alternativa acessível para quem busca morar próximo a Ribeirânia sem pagar os preços dos bairros mais nobres.',
        related: ['ribeirania', 'jardim-luiza', 'castelo-branco', 'sumarezinho']
    },
    'jardim-alexandre-balbo': {
        name: 'Jardim Alexandre Balbo',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1450, min: 720, max: 3200,
        unis: [],
        desc: 'bairro residencial em desenvolvimento na Zona Leste',
        longDesc: 'O Jardim Alexandre Balbo é um bairro em desenvolvimento na Zona Leste, com novos empreendimentos residenciais surgindo. Oferece aluguéis acessíveis e está bem posicionado entre Ribeirânia e os bairros do leste, com infraestrutura de comércio em crescimento.',
        related: ['jardim-luiza', 'ribeirania', 'jardim-presidente-dutra', 'castelo-branco']
    },
    'castelo-branco': {
        name: 'Castelo Branco',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1500, min: 750, max: 3500,
        unis: [],
        desc: 'bairro residencial bem localizado entre Zona Leste e Sul',
        longDesc: 'O Castelo Branco fica em posição estratégica entre a Zona Leste e Sul de Ribeirão Preto. Com infraestrutura consolidada e aluguéis moderados, oferece fácil acesso tanto ao centro quanto à região universitária, sendo procurado por profissionais e casais jovens.',
        related: ['ribeirania', 'sumarezinho', 'jardim-recreio', 'jardim-luiza']
    },
    'jardim-presidente-dutra': {
        name: 'Jardim Presidente Dutra',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1400, min: 700, max: 3000,
        unis: [],
        desc: 'bairro residencial acessível na Zona Leste',
        longDesc: 'O Jardim Presidente Dutra é um bairro residencial acessível na Zona Leste, com comércio local e transporte público para o centro. Uma opção prática para quem busca aluguéis moderados em um ambiente tranquilo, próximo à infraestrutura de Ribeirânia.',
        related: ['jardim-alexandre-balbo', 'jardim-luiza', 'ribeirania', 'jardim-recreio']
    },
    'sumarezinho': {
        name: 'Sumarezinho',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1600, min: 800, max: 3800,
        unis: ['USP-RP'],
        desc: 'bairro próximo à USP com vida universitária ativa',
        longDesc: 'O Sumarezinho é um dos bairros mais procurados por estudantes da USP de Ribeirão Preto. Com repúblicas, pensionatos e apartamentos para dividir, oferece uma vida universitária ativa com bares, restaurantes e fácil acesso ao campus.',
        related: ['monte-alegre', 'campos-eliseos', 'jardim-sumare', 'castelo-branco']
    },
    'monte-alegre': {
        name: 'Monte Alegre',
        zone: 'Zona Leste',
        tier: 'medio',
        avg2q: 1700, min: 850, max: 4000,
        unis: ['USP-RP'],
        desc: 'bairro residencial próximo ao campus da USP',
        longDesc: 'Monte Alegre é um bairro residencial de classe média próximo ao campus da USP. Combina a tranquilidade de ruas arborizadas com a praticidade de estar a minutos da universidade, sendo escolhido por pós-graduandos e professores que preferem um ambiente mais calmo.',
        related: ['sumarezinho', 'ribeirania', 'castelo-branco', 'jardim-sumare']
    },

    // ===== OUTROS =====
    'jardim-interlagos': {
        name: 'Jardim Interlagos',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1350, min: 680, max: 3000,
        unis: [],
        desc: 'bairro residencial com aluguéis moderados',
        longDesc: 'O Jardim Interlagos é um bairro residencial com infraestrutura de comércio local e aluguéis moderados. Uma opção prática para quem busca moradia acessível em Ribeirão Preto, com acesso por ônibus ao centro e às principais regiões da cidade.',
        related: ['jardim-maria-luiza', 'jardim-joao-rossi', 'jardim-manoel-penna']
    },
    'jardim-maria-luiza': {
        name: 'Jardim Maria Luiza',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1300, min: 650, max: 2800,
        unis: [],
        desc: 'bairro familiar com comércio de bairro',
        longDesc: 'O Jardim Maria Luiza é um bairro residencial familiar em Ribeirão Preto, com padarias, mercados e escolas nas proximidades. Oferece aluguéis acessíveis e um ambiente tranquilo, ideal para quem busca moradia econômica fora das zonas mais movimentadas.',
        related: ['jardim-interlagos', 'jardim-joao-rossi', 'jardim-manoel-penna']
    },
    'jardim-joao-rossi': {
        name: 'Jardim João Rossi',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1350, min: 680, max: 3000,
        unis: [],
        desc: 'bairro em expansão com novos empreendimentos',
        longDesc: 'O Jardim João Rossi é um bairro em expansão de Ribeirão Preto, com novos loteamentos e empreendimentos residenciais. Oferece aluguéis competitivos e uma infraestrutura em crescimento, atraindo quem busca imóveis mais novos com preços acessíveis.',
        related: ['jardim-interlagos', 'jardim-maria-luiza', 'parque-dos-lagos']
    },
    'adelino-simioni': {
        name: 'Adelino Simioni',
        zone: 'Outros',
        tier: 'popular',
        avg2q: 1050, min: 500, max: 2100,
        unis: [],
        desc: 'bairro econômico com aluguéis a partir de R$ 500',
        longDesc: 'O Adelino Simioni é um bairro econômico de Ribeirão Preto com aluguéis a partir de R$ 500. Localizado na periferia, oferece comércio básico e transporte público, sendo uma das opções mais baratas da cidade para quem precisa economizar no custo de moradia.',
        related: ['simioni', 'avelino-alves-palma', 'quintino-facci-ii', 'parque-industrial']
    },
    'vila-albertina': {
        name: 'Vila Albertina',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1300, min: 650, max: 2800,
        unis: [],
        desc: 'bairro residencial com infraestrutura básica consolidada',
        longDesc: 'A Vila Albertina é um bairro residencial com infraestrutura consolidada em Ribeirão Preto. Com supermercados, escolas e linhas de ônibus, oferece aluguéis acessíveis em um ambiente de bairro tradicional, ideal para quem busca praticidade e economia.',
        related: ['jardim-manoel-penna', 'jardim-maria-luiza', 'jardim-interlagos']
    },
    'jardim-manoel-penna': {
        name: 'Jardim Manoel Penna',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1300, min: 650, max: 2800,
        unis: [],
        desc: 'bairro residencial tranquilo com comércio local',
        longDesc: 'O Jardim Manoel Penna é um bairro residencial tranquilo de Ribeirão Preto, com comércio local e praças. Oferece aluguéis acessíveis e um ambiente calmo, sendo uma opção prática para famílias e profissionais que buscam moradia fora das áreas mais caras.',
        related: ['vila-albertina', 'jardim-interlagos', 'jardim-maria-luiza']
    },
    'parque-dos-lagos': {
        name: 'Parque dos Lagos',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1400, min: 700, max: 3200,
        unis: [],
        desc: 'bairro com áreas verdes e empreendimentos recentes',
        longDesc: 'O Parque dos Lagos é um bairro com áreas verdes e lagos que dão nome à região. Com empreendimentos recentes e infraestrutura em crescimento, oferece uma opção de moradia agradável com preços acessíveis, ideal para quem valoriza contato com a natureza.',
        related: ['jardim-joao-rossi', 'jardim-interlagos', 'jardim-das-palmeiras']
    },
    'jardim-das-palmeiras': {
        name: 'Jardim das Palmeiras',
        zone: 'Outros',
        tier: 'medio',
        avg2q: 1350, min: 680, max: 3000,
        unis: [],
        desc: 'bairro residencial com ruas arborizadas',
        longDesc: 'O Jardim das Palmeiras é um bairro residencial com ruas arborizadas e ambiente tranquilo em Ribeirão Preto. Com comércio de bairro e aluguéis moderados, atrai moradores que buscam sossego e qualidade de vida sem pagar os preços dos bairros nobres.',
        related: ['parque-dos-lagos', 'jardim-joao-rossi', 'jardim-interlagos']
    }
};

module.exports = { BAIRROS: BAIRROS, BEDROOM_MULTIPLIER: BEDROOM_MULTIPLIER, CITY_AVG_2Q: CITY_AVG_2Q };
