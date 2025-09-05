const express = require('express');
const router = express.Router();
const pumpFunController = require('../controllers/pumpFunController');
const authMiddleware = require('../middlewares/authMiddlewares');

router.use(authMiddleware.protect);

router.post('/withdraw-gotoken', pumpFunController.withdrawGoToken);

module.exports = router;
