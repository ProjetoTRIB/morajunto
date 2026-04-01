// Upload all site images (Unsplash) to Cloudinary and update source files
// Usage: node scripts/upload-site-images.js

require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// All Unsplash images used in the app
const IMAGES = [
    {
        name: 'hero-banner',
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=600&fit=crop',
        folder: 'morajunto/site'
    },
    {
        name: 'lp-hero',
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&h=700&fit=crop',
        folder: 'morajunto/site'
    },
    {
        name: 'property-placeholder',
        url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop',
        folder: 'morajunto/site'
    },
    {
        name: 'demo-apto-centro-1',
        url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-apto-centro-2',
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-apto-centro-3',
        url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-casa-3quartos-1',
        url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-casa-3quartos-2',
        url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-kitnet',
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-cobertura-1',
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-cobertura-2',
        url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-cobertura-3',
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-sala-comercial',
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-apto-lagoinha-1',
        url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'demo-apto-lagoinha-2',
        url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop',
        folder: 'morajunto/demo'
    },
    {
        name: 'republica-placeholder',
        url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop',
        folder: 'morajunto/site'
    }
];

async function uploadAll() {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.error('ERRO: Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no .env');
        process.exit(1);
    }

    console.log('Subindo ' + IMAGES.length + ' imagens para o Cloudinary...\n');

    var mapping = {};

    for (var img of IMAGES) {
        try {
            process.stdout.write('  ' + img.name + '... ');
            var result = await cloudinary.uploader.upload(img.url, {
                folder: img.folder,
                public_id: img.name,
                overwrite: true,
                resource_type: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto' }]
            });
            mapping[img.name] = result.secure_url;
            console.log('OK -> ' + result.secure_url);
        } catch (e) {
            console.log('ERRO: ' + e.message);
        }
    }

    // Save mapping
    var mappingPath = path.join(__dirname, '..', 'backend', 'config', 'siteImages.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log('\nMapping salvo em: backend/config/siteImages.json');

    // Auto-replace in source files
    console.log('\nAtualizando arquivos fonte...');

    // Replace in style.css
    var cssPath = path.join(__dirname, '..', 'style.css');
    var css = fs.readFileSync(cssPath, 'utf-8');
    if (mapping['hero-banner']) {
        css = css.replace(
            /url\('https:\/\/images\.unsplash\.com\/photo-1600585154340-be6161a56a0c\?w=1600&h=600&fit=crop'\)/g,
            "url('" + mapping['hero-banner'] + "')"
        );
    }
    if (mapping['lp-hero']) {
        css = css.replace(
            /url\('https:\/\/images\.unsplash\.com\/photo-1560448204-e02f11c3d0e2\?w=1600&h=700&fit=crop'\)/g,
            "url('" + mapping['lp-hero'] + "')"
        );
    }
    fs.writeFileSync(cssPath, css);
    console.log('  style.css atualizado');

    // Replace in script.js
    var jsPath = path.join(__dirname, '..', 'script.js');
    var js = fs.readFileSync(jsPath, 'utf-8');

    var jsReplacements = {
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop': mapping['property-placeholder'],
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop': mapping['demo-apto-centro-1'],
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop': mapping['demo-apto-centro-2'],
        'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop': mapping['demo-apto-centro-3'],
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop': mapping['demo-casa-3quartos-1'],
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop': mapping['demo-casa-3quartos-2'],
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop': mapping['demo-kitnet'],
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop': mapping['demo-cobertura-1'],
        'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop': mapping['demo-cobertura-2'],
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop': mapping['demo-cobertura-3'],
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop': mapping['demo-sala-comercial'],
        'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop': mapping['demo-apto-lagoinha-1'],
        'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop': mapping['demo-apto-lagoinha-2']
    };

    for (var oldUrl in jsReplacements) {
        if (jsReplacements[oldUrl]) {
            js = js.split(oldUrl).join(jsReplacements[oldUrl]);
        }
    }
    fs.writeFileSync(jsPath, js);
    console.log('  script.js atualizado');

    // Replace in republicas.js if exists
    var repPath = path.join(__dirname, '..', 'republicas.js');
    if (fs.existsSync(repPath)) {
        var rep = fs.readFileSync(repPath, 'utf-8');
        for (var oldUrl in jsReplacements) {
            if (jsReplacements[oldUrl]) {
                rep = rep.split(oldUrl).join(jsReplacements[oldUrl]);
            }
        }
        fs.writeFileSync(repPath, rep);
        console.log('  republicas.js atualizado');
    }

    console.log('\nPronto! Todas as imagens agora estao no seu Cloudinary.');
    console.log('Faca deploy para aplicar as mudancas.');
}

uploadAll().catch(function(e) {
    console.error('Erro fatal:', e);
    process.exit(1);
});
