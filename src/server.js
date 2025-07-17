// src/server.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: './.env' });

const app = require('./app'); // Import the Express app
const connectDB = require('./config/db'); // Import DB connection function
const config = require('./config/config'); // Import config for port

// Handle uncaught exceptions
process.on('uncaughtException', err => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

// Connect to MongoDB
connectDB();

// Start the server
const port = config.port || 3000;
const server = app.listen(port, () => {
    console.log(`Server running on port ${port} in ${config.env} mode.`);
});

// Handle unhandled promise rejections (e.g., DB connection errors)
process.on('unhandledRejection', err => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err.message, err.stack);
    server.close(() => {
        process.exit(1);
    });
});

// For graceful shutdown in containerized environments
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
        console.log('Process terminated!');
    });
});