const { ethers } = require('ethers');

/**
 * Verifies a signature from a wallet (e.g., MetaMask) for login/authentication.
 * @param {string} address - The public wallet address claimed by the user.
 * @param {string} signature - The signature provided by the user.
 * @param {string} originalMessage - The original message that was signed.
 * @returns {boolean} - True if the signature is valid and matches the address.
 */
async function verifySignature(address, signature, originalMessage) {
    try {
        // Add Ethereum prefix to the message
        const prefixedMessage = ethers.hashMessage(originalMessage);
        console.log('[WalletConnect] Prefixed Message:', prefixedMessage); // Log the prefixed message
        const recovered = ethers.verifyMessage(prefixedMessage, signature);
        console.log('[WalletConnect] Recovered Address:', recovered);
        return recovered.toLowerCase() === address.toLowerCase();
    } catch (err) {
        console.error('[WalletConnect] Signature verification error:', err, {
            address,
            signature,
            originalMessage
        });
        return false;
    }
}

/**
 * Generates a random nonce message for the user to sign (prevents replay attacks).
 * @param {string} address - The user's wallet address.
 * @returns {string} - The message to be signed.
 */
function generateNonceMessage(address) {
    const nonce = Math.floor(Math.random() * 1e16);
    return `Sign this message to authenticate with GoCoin.\nAddress: ${address}\nNonce: ${nonce}`;
}

/**
 * Generates EIP-712 structured data for signing.
 * @param {string} address - The user's wallet address.
 * @returns {object} - The structured data to be signed.
 */
function generateEIP712Data(address) {
    const domain = {
        name: 'GoCoin',
        version: '1',
        chainId: 1, // Mainnet (change for testnets)
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' // Example contract address
    };

    const types = {
        Auth: [
            { name: 'address', type: 'address' },
            { name: 'nonce', type: 'uint256' }
        ]
    };

    // Ensure nonce is within the safe range
    const nonce = Math.floor(Math.random() * 1e12); // Use a smaller range for nonce

    const message = {
        address,
        nonce
    };

    return { domain, types, message }; // Return structured data
}

/**
 * Verifies the EIP-712 signature.
 * @param {string} address - The public wallet address claimed by the user.
 * @param {string} signature - The signature provided by the user.
 * @param {object} structuredData - The structured data that was signed.
 * @returns {boolean} - True if the signature is valid and matches the address.
 */
async function verifyEIP712Signature(address, signature, structuredData) {
    try {
        const { domain, types, message } = structuredData;
        const recovered = ethers.utils.verifyTypedData(domain, types, message, signature);
        console.log('[WalletConnect] Recovered Address:', recovered);
        return recovered.toLowerCase() === address.toLowerCase();
    } catch (err) {
        console.error('[WalletConnect] EIP-712 Signature verification error:', err);
        return false;
    }
}

module.exports = {
    verifySignature,
    generateNonceMessage,
    generateEIP712Data,
    verifyEIP712Signature
};
