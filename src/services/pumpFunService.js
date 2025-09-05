
require('dotenv').config();
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, transfer } = require('@solana/spl-token');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const bs58 = require('bs58');

const connection = new Connection(process.env.RPC_URL || clusterApiUrl('mainnet-beta'));
const mnemonic = process.env.ADMIN_SECRET_KEY;
if (!mnemonic) throw new Error('ADMIN_SECRET_KEY not set');
const seed = mnemonicToSeedSync(mnemonic);
const path = "m/44'/501'/0'/0'"; // Solana standard derivation
const derivedSeed = derivePath(path, seed.toString('hex')).key;
const admin = Keypair.fromSeed(derivedSeed);

console.log('Loaded GOTOKEN_MINT:', process.env.GOTOKEN_MINT);
// const mint = new PublicKey(process.env.GOTOKEN_MINT);

// console.log('mint address:', mint.toBase58());
console.log('Admin Public Key:', admin.publicKey.toBase58());

/**
 * Send GoToken from admin vault to a user's wallet address
 * @param {string} address - Recipient's wallet address
 * @param {number} amount - Amount of GoToken to send (in whole tokens, not smallest units)
 * @returns {Promise<string>} Transaction signature
 */
exports.sendGoTokenToUser = async (address, amount) => {
  if (!address || !amount || isNaN(amount) || Number(amount) <= 0) {
    throw new Error('Invalid address or amount');
  }
  const toWallet = new PublicKey(address);

  // Get or create sender's and recipient's token accounts
  // const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
  //   connection, admin, mint, admin.publicKey
  // );
  // const toTokenAccount = await getOrCreateAssociatedTokenAccount(
  //   connection, admin, mint, toWallet
  // );

  // Check admin balance
  const adminBalance = await connection.getTokenAccountBalance(fromTokenAccount.address);
  if (Number(adminBalance.value.uiAmount) < Number(amount)) {
    throw new Error('Insufficient GoToken balance in admin wallet');
  }

  // Transfer tokens (assume 6 decimals, adjust if needed)
  const decimals = 6;
  const txSig = await transfer(
    connection,
    admin,
    fromTokenAccount.address,
    toTokenAccount.address,
    admin.publicKey,
    Math.floor(Number(amount) * 10 ** decimals)
  );

  return txSig;
};
