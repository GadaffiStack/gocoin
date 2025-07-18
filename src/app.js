// src/app.js
const express = require('express');
const morgan = require('morgan'); // For request logging
const helmet = require('helmet'); // For security headers
const cors = require('cors'); // For Cross-Origin Resource Sharing
// const mongoSanitize = require('express-mongo-sanitize'); // Prevent MongoDB operator injection
// const xss = require('xss-clean'); // Prevent XSS attacks
const hpp = require('hpp'); // Prevent HTTP Parameter Pollution
const rateLimit = require('express-rate-limit'); // For rate limiting requests

const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes'); // Import combined routes

const app = express();

// Set security HTTP headers
// app.use(helmet());

// Development logging
// if (process.env.NODE_ENV === 'development') {
//     app.use(morgan('dev'));
// }

// Limit requests from same API
const limiter = rateLimit({
    max: 100, // max 100 requests
    windowMs: 60 * 60 * 1000, // per 1 hour
    message: 'Too many requests from this IP, please try again in an hour!'
});
// app.use('/api', limiter); // Apply to all API routes

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// Data sanitization against XSS
// app.use(xss());

// Prevent parameter pollution
app.use(hpp({
    whitelist: [ // Allow specific parameters to be repeated if needed (e.g., interests)
        'interests', 'type', 'status', 'period'
    ]
}));

// Enable CORS for all routes (adjust for production)
app.use(cors());

// Mount API routes
app.use('/api', apiRoutes);

// Handle undefined routes
// app.all('*', (req, res, next) => {
//     next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;