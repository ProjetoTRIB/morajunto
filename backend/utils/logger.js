// Logger estruturado mínimo — sem deps, usa console sob o capô.
// Formato: [ISO-TIMESTAMP] [LEVEL] [SCOPE] mensagem { meta }

var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
var MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function fmt(level, scope, msg, meta) {
    var line = '[' + new Date().toISOString() + '] [' + level.toUpperCase() + '] [' + scope + '] ' + msg;
    if (meta && Object.keys(meta).length > 0) {
        try { line += ' ' + JSON.stringify(meta); } catch (e) { line += ' [meta unserializable]'; }
    }
    return line;
}

function makeLogger(scope) {
    return {
        debug: function(msg, meta) {
            if (LEVELS.debug < MIN_LEVEL) return;
            console.log(fmt('debug', scope, msg, meta));
        },
        info: function(msg, meta) {
            if (LEVELS.info < MIN_LEVEL) return;
            console.log(fmt('info', scope, msg, meta));
        },
        warn: function(msg, meta) {
            if (LEVELS.warn < MIN_LEVEL) return;
            console.warn(fmt('warn', scope, msg, meta));
        },
        error: function(msg, meta) {
            if (LEVELS.error < MIN_LEVEL) return;
            console.error(fmt('error', scope, msg, meta));
        }
    };
}

module.exports = makeLogger;
