const mongoose = require('mongoose');

// Middleware factory: validates that req.params[paramName] is a valid MongoDB ObjectId
function validateId(paramName) {
    paramName = paramName || 'id';
    return function(req, res, next) {
        var id = req.params[paramName];
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        next();
    };
}

// Simple check function (non-middleware)
function isValidObjectId(id) {
    return id && mongoose.Types.ObjectId.isValid(id);
}

module.exports = { validateId, isValidObjectId };
