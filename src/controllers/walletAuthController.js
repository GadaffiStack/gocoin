// src/controllers/walletAuthController.js
const walletConnectService = require('../services/walletConnectService');

// POST /wallet-auth/nonce
exports.getNonce = async (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ message: 'Address required' });

    // Generate EIP-712 structured data
    const structuredData = walletConnectService.generateEIP712Data(address);
    res.json({ structuredData });
};

// POST /wallet-auth/verify
exports.verifySignature = async (req, res) => {
    const { address, signature, structuredData } = req.body;
    if (!address || !signature || !structuredData) {
        return res.status(400).json({ message: 'Missing fields' });
    }
    try {
        const valid = await walletConnectService.verifyEIP712Signature(address, signature, structuredData);
        if (valid) {
            // Authenticate user or link wallet here
            return res.json({ success: true, message: 'Signature verified' });
        }
        // Log details for debugging
        console.error('[WalletAuth] Invalid signature:', {
            address,
            signature,
            structuredData
        });
        res.status(401).json({ success: false, message: 'Invalid signature', debug: { address, signature, structuredData } });
    } catch (err) {
        // Log error details
        console.error('[WalletAuth] Signature verification error:', err, {
            address,
            signature,
            structuredData
        });
        res.status(500).json({ success: false, message: 'Internal error during signature verification', error: err.message });
    }
};
