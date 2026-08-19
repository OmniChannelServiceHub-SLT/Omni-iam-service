// src/utils/otp.js
const crypto = require('crypto');
const Otp = require('../models/Otp');

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 4);
const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MIN || 5);
const OTP_DEV_MODE = String(process.env.OTP_DEV_MODE || 'true') === 'true';

function generateCode() {
  const max = 10 ** OTP_LENGTH;
  const code = crypto.randomInt(0, max);
  return String(code).padStart(OTP_LENGTH, '0');
}

/**
 * Creates an OTP record for userName/purpose and returns it.
 * dataBundle in the legacy contract is this record's _id (as a string) -
 * the client sends it back together with the code to verify/reset.
 */
async function createOtp(userName, purpose) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000);

  const otp = await Otp.create({ userName, code, purpose, expiresAt });

  // TODO: wire this up to a real SMS/email gateway before production.
  // In dev mode we just log it so the flow can be tested end-to-end
  // without a live SMS provider.
  if (OTP_DEV_MODE) {
    // eslint-disable-next-line no-console
    console.log(`[OTP][${purpose}] userName=${userName} code=${code} id=${otp._id}`);
  }

  return otp;
}

/**
 * Verifies { id, code } against a stored, unconsumed, unexpired OTP.
 * Returns the Otp document on success or throws with a .code for the caller.
 */
async function verifyOtp({ id, code, purpose }) {
  const otp = await Otp.findById(id);

  if (!otp || otp.purpose !== purpose) {
    const err = new Error('OTP request not found.');
    err.code = 'OTP_NOT_FOUND';
    throw err;
  }

  if (otp.consumed) {
    const err = new Error('OTP has already been used.');
    err.code = 'OTP_ALREADY_USED';
    throw err;
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    const err = new Error('OTP has expired.');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  if (String(otp.code) !== String(code)) {
    otp.attempts += 1;
    await otp.save();
    const err = new Error('Incorrect OTP.');
    err.code = 'OTP_INVALID';
    throw err;
  }

  otp.consumed = true;
  await otp.save();

  return otp;
}

module.exports = { createOtp, verifyOtp, OTP_DEV_MODE };
