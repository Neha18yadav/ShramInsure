// services/paymentService.js — Razorpay-structured payment service with simulation fallback
// In production: replace mock with real Razorpay SDK calls

'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Razorpay mock config ──────────────────────────────────────────────────────
// In production: const Razorpay = require('razorpay');
// const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

const PAYMENT_CONFIG = {
  currency: 'INR',
  minPayout: 50,
  maxPayout: 50000,
  settlementDelayMs: 500, // simulate network delay
  successRate: 0.97,      // 97% simulated success rate
};

/**
 * initiatePayout — Creates a Razorpay payout (mock structure)
 * @param {object} opts
 * @param {number} opts.amount        — Payout amount in INR
 * @param {string} opts.upiId         — Recipient UPI ID
 * @param {string} opts.name          — Recipient name
 * @param {string} opts.purpose       — Purpose of payout ('insurance_claim')
 * @param {string} opts.referenceId   — Claim number / reference
 * @returns {Promise<object>} payout result
 */
const initiatePayout = async ({ amount, upiId, name, purpose = 'insurance_claim', referenceId }) => {
  console.log(`[PaymentService] Initiating payout: ₹${amount} → ${upiId} (ref: ${referenceId})`);

  // Validate
  if (!amount || amount < PAYMENT_CONFIG.minPayout) {
    throw new Error(`Payout amount ₹${amount} is below minimum ₹${PAYMENT_CONFIG.minPayout}`);
  }
  if (amount > PAYMENT_CONFIG.maxPayout) {
    throw new Error(`Payout amount ₹${amount} exceeds maximum ₹${PAYMENT_CONFIG.maxPayout}`);
  }
  if (!upiId || !upiId.includes('@')) {
    throw new Error(`Invalid UPI ID: ${upiId}`);
  }

  // Simulate network delay
  await new Promise(r => setTimeout(r, PAYMENT_CONFIG.settlementDelayMs));

  // Simulate occasional failures (3%)
  const success = Math.random() < PAYMENT_CONFIG.successRate;

  if (!success) {
    const failureReasons = [
      'UPI_ID_INVALID', 'BANK_ACCOUNT_CLOSED', 'TRANSACTION_LIMIT_EXCEEDED', 'NETWORK_TIMEOUT'
    ];
    const reason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
    console.error(`[PaymentService] Payout FAILED: ${reason} for ref ${referenceId}`);
    return {
      success: false,
      status: 'failed',
      error: reason,
      referenceId,
      txnId: null,
      amount,
      upiId,
      timestamp: new Date().toISOString(),
    };
  }

  // Mock Razorpay payout response structure
  const txnId = `RZP-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 12)}`;
  const rzpPayoutId = `pout_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

  const payoutResponse = {
    success: true,
    status: 'processed',
    txnId,
    rzpPayoutId,
    referenceId,
    amount,
    amountInPaisa: amount * 100,
    currency: PAYMENT_CONFIG.currency,
    upiId,
    recipientName: name,
    purpose,
    method: 'UPI',
    mode: 'IMPS',
    narration: `ShramInsure Parametric Claim - ${referenceId}`,
    timestamp: new Date().toISOString(),
    settledAt: new Date().toISOString(),
    // Razorpay-compatible metadata
    entity: 'payout',
    fund_account: { vpa: upiId },
    fees: 0,
    tax: 0,
  };

  console.log(`[PaymentService] ✅ Payout SUCCESS: TXN ${txnId} — ₹${amount} → ${upiId}`);
  return payoutResponse;
};

/**
 * initiateRefund — Reversal for rejected/cancelled payouts
 */
const initiateRefund = async ({ txnId, amount, reason }) => {
  console.log(`[PaymentService] Initiating refund: TXN ${txnId} ₹${amount} — ${reason}`);
  await new Promise(r => setTimeout(r, 300));

  const refundId = `REF-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 10)}`;
  return {
    success: true,
    status: 'refunded',
    refundId,
    originalTxnId: txnId,
    amount,
    reason,
    timestamp: new Date().toISOString(),
  };
};

/**
 * verifyPayment — Verify a payout status (webhook simulation)
 */
const verifyPayment = async (txnId) => {
  console.log(`[PaymentService] Verifying payment: ${txnId}`);
  await new Promise(r => setTimeout(r, 200));

  if (!txnId || (!txnId.startsWith('RZP-') && !txnId.startsWith('TXN-'))) {
    return { verified: false, status: 'not_found', txnId };
  }

  return {
    verified: true,
    status: 'processed',
    txnId,
    verifiedAt: new Date().toISOString(),
  };
};

/**
 * generateUpiId — Generate default UPI ID from phone
 */
const generateUpiId = (phone) => `${phone}@upi`;

module.exports = { initiatePayout, initiateRefund, verifyPayment, generateUpiId, PAYMENT_CONFIG };
