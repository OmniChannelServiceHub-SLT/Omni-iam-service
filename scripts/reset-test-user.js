// Automatic password reset bypass removed. Use ForgotPassword with a recovery OTP.
console.error('Use the OTP recovery flow. To create a NEW local test user, use npm run seed:test with explicit development-only settings.');
process.exitCode = 1;
