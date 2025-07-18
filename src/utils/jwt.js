// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');

function generateToken(userId) {
    return jwt.sign({ id: userId }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn || '7d'
    });
}

module.exports = { generateToken };
