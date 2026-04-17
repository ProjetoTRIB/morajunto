// Helpers de busca textual — acento-insensitive, safe para regex.

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Gera regex que ignora acentos. Ex: "sumare" encontra "Sumaré", "sao paulo" encontra "São Paulo".
function accentRegex(str) {
    var map = {
        'a': '[aáàâã]', 'e': '[eéèê]', 'i': '[iíì]', 'o': '[oóòôõ]', 'u': '[uúù]',
        'c': '[cç]', 'n': '[nñ]'
    };
    var escaped = escapeRegex(str);
    var pattern = '';
    for (var i = 0; i < escaped.length; i++) {
        var ch = escaped[i].toLowerCase();
        pattern += map[ch] || escaped[i];
    }
    return new RegExp(pattern, 'i');
}

// Retorna "YYYY-MM" no fuso America/Sao_Paulo (para currentMonth consistente)
function currentMonthBR(date) {
    var d = date || new Date();
    var parts = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/');
    return parts[2] + '-' + parts[1]; // "YYYY-MM"
}

function currentDayBR(date) {
    var d = date || new Date();
    var day = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit' });
    return parseInt(day, 10);
}

module.exports = {
    escapeRegex: escapeRegex,
    accentRegex: accentRegex,
    currentMonthBR: currentMonthBR,
    currentDayBR: currentDayBR
};
