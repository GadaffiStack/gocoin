// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const config = require('../config/config');

exports.protect = catchAsync(async (req, res, next) => {
    // 1) Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, config.jwtSecret);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Optional: Check if user changed password after token was issued
    // if (currentUser.changedPasswordAfter(decoded.iat)) {
    //   return next(new AppError('User recently changed password! Please log in again.', 401));
    // }

    // Grant access to protected route
    req.user = currentUser;
    next();
});

exports.restrictTo = (...roles) => { // Example for future admin roles
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) { // Assuming 'role' field on User model
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};