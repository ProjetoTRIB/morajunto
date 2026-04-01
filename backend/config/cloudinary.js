const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('[Cloudinary] Credenciais não configuradas — uploads de imagem não funcionarão.');
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function createStorage(folder) {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: folder,
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        }
    });
}

module.exports = { cloudinary, createStorage };
