const https = require('https');

// Geocode address using Nominatim (OpenStreetMap — free, no API key)
function geocode(address, neighborhood, city) {
    var query = [address, neighborhood, city || 'Ribeirão Preto', 'SP', 'Brasil']
        .filter(Boolean).join(', ');

    return new Promise(function(resolve, reject) {
        var url = '/search?q=' + encodeURIComponent(query) + '&format=json&limit=1&countrycodes=br';
        var req = https.request({
            hostname: 'nominatim.openstreetmap.org',
            path: url,
            method: 'GET',
            headers: { 'User-Agent': 'MoraJunto/1.0 (contatomorajunto@gmail.com)' }
        }, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try {
                    var results = JSON.parse(data);
                    if (results && results.length > 0) {
                        resolve({
                            lat: parseFloat(results[0].lat),
                            lng: parseFloat(results[0].lon),
                            displayName: results[0].display_name
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(new Error('Erro ao geocodificar'));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Query Overpass API for nearby POIs
function fetchNearbyPOIs(lat, lng, radiusMeters) {
    radiusMeters = radiusMeters || 1500;

    // Overpass QL: find amenities, shops, leisure, education, health near the point
    var query = '[out:json][timeout:15];(' +
        'node["amenity"~"university|school|college"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'node["amenity"~"hospital|clinic|pharmacy"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'node["amenity"~"restaurant|cafe|bar|fast_food"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'node["shop"~"supermarket|bakery|convenience"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'node["amenity"~"bus_station|bank|atm"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'node["leisure"~"park|fitness_centre|sports_centre|swimming_pool"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'node["amenity"~"gym|place_of_worship|library"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'way["amenity"~"university|school|college|hospital"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'way["leisure"~"park"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
        'way["shop"~"supermarket|mall|shopping_centre"](around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
    ');out center 100;';

    var body = 'data=' + encodeURIComponent(query);

    return new Promise(function(resolve, reject) {
        var req = https.request({
            hostname: 'overpass-api.de',
            path: '/api/interpreter',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'MoraJunto/1.0'
            }
        }, function(res) {
            var data = '';
            res.on('data', function(chunk) { data += chunk; });
            res.on('end', function() {
                try {
                    var result = JSON.parse(data);
                    resolve(result.elements || []);
                } catch (e) {
                    reject(new Error('Erro ao buscar POIs'));
                }
            });
        });
        req.on('error', reject);
        req.end(body);
    });
}

// Calculate distance in meters between two lat/lng points (Haversine)
function distanceMeters(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Categorize and format POIs
function categorizePOIs(elements, lat, lng) {
    var categories = {
        universidades: { icon: '🎓', label: 'Universidades e Escolas', items: [], tags: ['university', 'school', 'college'] },
        saude: { icon: '🏥', label: 'Saúde', items: [], tags: ['hospital', 'clinic', 'pharmacy'] },
        mercados: { icon: '🛒', label: 'Mercados e Padarias', items: [], tags: ['supermarket', 'bakery', 'convenience', 'mall', 'shopping_centre'] },
        restaurantes: { icon: '🍽️', label: 'Restaurantes e Cafés', items: [], tags: ['restaurant', 'cafe', 'bar', 'fast_food'] },
        lazer: { icon: '🌳', label: 'Lazer e Esportes', items: [], tags: ['park', 'fitness_centre', 'sports_centre', 'swimming_pool', 'gym'] },
        servicos: { icon: '🏦', label: 'Serviços', items: [], tags: ['bank', 'atm', 'bus_station', 'library', 'place_of_worship'] }
    };

    elements.forEach(function(el) {
        var tags = el.tags || {};
        var name = tags.name || tags['name:pt'] || '';
        if (!name) return;

        var elLat = el.lat || (el.center && el.center.lat);
        var elLng = el.lon || (el.center && el.center.lon);
        if (!elLat || !elLng) return;

        var dist = Math.round(distanceMeters(lat, lng, elLat, elLng));
        var amenity = tags.amenity || '';
        var shop = tags.shop || '';
        var leisure = tags.leisure || '';
        var allTags = amenity + ' ' + shop + ' ' + leisure;

        var poi = { name: name, distance: dist, type: amenity || shop || leisure };

        var placed = false;
        Object.keys(categories).forEach(function(catKey) {
            if (placed) return;
            var cat = categories[catKey];
            if (cat.tags.some(function(t) { return allTags.includes(t); })) {
                // Avoid duplicates by name
                if (!cat.items.some(function(existing) { return existing.name === name; })) {
                    cat.items.push(poi);
                }
                placed = true;
            }
        });
    });

    // Sort each category by distance, limit to top 5
    Object.keys(categories).forEach(function(catKey) {
        categories[catKey].items.sort(function(a, b) { return a.distance - b.distance; });
        categories[catKey].items = categories[catKey].items.slice(0, 5);
    });

    // Remove empty categories
    var result = {};
    Object.keys(categories).forEach(function(catKey) {
        if (categories[catKey].items.length > 0) {
            result[catKey] = categories[catKey];
        }
    });

    return result;
}

// Generate neighborhood scores based on POI density
function generateScores(categorizedPOIs) {
    var scores = {
        security: 65,
        transport: 50,
        commerce: 50,
        leisure: 50,
        quiet: 70
    };

    // Transport: bus stations, proximity to services
    var servicePOIs = categorizedPOIs.servicos;
    if (servicePOIs) {
        var busStations = servicePOIs.items.filter(function(p) { return p.type === 'bus_station'; });
        scores.transport = Math.min(95, 50 + busStations.length * 15 + servicePOIs.items.length * 5);
    }

    // Commerce: markets + restaurants
    var mercados = categorizedPOIs.mercados;
    var restaurantes = categorizedPOIs.restaurantes;
    var commerceCount = (mercados ? mercados.items.length : 0) + (restaurantes ? restaurantes.items.length : 0);
    scores.commerce = Math.min(95, 40 + commerceCount * 8);

    // Leisure: parks, gyms, sports
    var lazer = categorizedPOIs.lazer;
    if (lazer) {
        scores.leisure = Math.min(95, 40 + lazer.items.length * 12);
    }

    // Quiet: inverse of restaurants/bars nearby (many bars = less quiet)
    if (restaurantes) {
        var bars = restaurantes.items.filter(function(p) { return p.type === 'bar'; });
        scores.quiet = Math.max(30, 80 - bars.length * 10);
    }

    // Security: boost if has hospitals, police, schools nearby
    var saude = categorizedPOIs.saude;
    var unis = categorizedPOIs.universidades;
    if (saude) scores.security = Math.min(90, scores.security + saude.items.length * 5);
    if (unis) scores.security = Math.min(90, scores.security + unis.items.length * 3);

    return scores;
}

// Main function: get everything for a property
async function getLocationData(address, neighborhood, city) {
    var coords = await geocode(address, neighborhood, city);
    if (!coords) {
        // Fallback: try just neighborhood + city
        coords = await geocode('', neighborhood, city);
    }
    if (!coords) return null;

    var elements = await fetchNearbyPOIs(coords.lat, coords.lng, 1500);
    var categorized = categorizePOIs(elements, coords.lat, coords.lng);
    var scores = generateScores(categorized);

    return {
        latitude: coords.lat,
        longitude: coords.lng,
        nearbyPOIs: categorized,
        neighborhoodScore: scores
    };
}

module.exports = { geocode, fetchNearbyPOIs, categorizePOIs, generateScores, getLocationData, distanceMeters };
