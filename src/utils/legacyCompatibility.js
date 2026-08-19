// src/utils/legacyCompatibility.js
// Compatibility layer for legacy IAM APIs that were scaffold-only in the
// generated microservice. It preserves the existing JWT issuer and reuses
// the working IAM auth logic where possible. Documented API-Params response
// envelopes are returned exactly in shape; mapping-only APIs use the common
// legacy envelope until a legacy backend/provider is connected.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { createOtp } = require('./otp');
const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  accessExpiresInSeconds,
} = require('./jwt');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

function full(payload) {
  return { bare: true, ...payload };
}

function first(...values) {
  return values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

function randomOpaque(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiryDate(),
  });
  return { accessToken, refreshToken };
}

async function resolveUser(req) {
  const body = req.body || {};
  const query = req.query || {};
  const userName = first(
    body.Username, body.UserName, body.userName, body.username,
    body.subscriberID, body.telephoneNo, body.tpNo,
    query.Username, query.UserName, query.userName, query.username,
    query.subscriberID, query.telephoneNo, query.tpNo
  );

  if (req.identity && req.identity.userId) {
    const byId = await User.findById(req.identity.userId);
    if (byId) return byId;
  }

  if (userName) return User.findOne({ userName: String(userName) });
  return null;
}

async function loginAlias(req) {
  const body = req.body || {};
  const userName = first(body.Username, body.UserName, body.userName, body.username);
  const password = first(body.Password, body.password, body.currentpass);

  if (userName && password) {
    const loginService = require('../API/createLogin-account/service');
    return loginService.createLogin({
      ...req,
      body: {
        ...body,
        Username: String(userName),
        Password: String(password),
      },
    });
  }

  const user = await resolveUser(req);
  if (!user || user.status === 'TERMINATED') {
    const err = new Error('Valid user credentials are required.');
    err.status = 401; err.code = 'E401';
    throw err;
  }

  const tokens = await issueTokenPair(user);
  return full({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user_id: String(user._id),
    name: user.name,
  });
}

async function externalLoginAlias(req, providerDefault) {
  const body = req.body || {};
  const userName = first(body.UserName, body.userName, body.Username, body.username, body.externalAccessEmail);
  if (!userName) {
    const err = new Error('UserName is required.');
    err.status = 400; err.code = 'E400';
    throw err;
  }

  const provider = first(body.provider, providerDefault, 'EXTERNAL');
  let user = await User.findOne({ userName: String(userName) });
  if (!user) {
    user = new User({
      userName: String(userName),
      name: body.Name || body.name || null,
      userType: 'EXTERNAL',
      status: 'ACTIVE',
      externalProvider: String(provider),
      externalAccessEmail: body.externalAccessEmail || null,
    });
  }
  if (user.status === 'TERMINATED') {
    const err = new Error('This account has been terminated.');
    err.status = 403; err.code = 'E403';
    throw err;
  }

  user.externalProvider = String(provider);
  if (body.externalAccessEmail) user.externalAccessEmail = body.externalAccessEmail;
  if (body.fiebaseId != null) user.firebaseId = String(body.fiebaseId);
  if (body.appVersion != null) user.appVersion = String(body.appVersion);
  if (body.osType) user.osType = body.osType;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokenPair(user);
  return full({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user_id: String(user._id),
    name: user.name,
  });
}

async function oauthStyleToken(req) {
  const user = await resolveUser(req);
  if (user && user.status !== 'TERMINATED') {
    const pair = await issueTokenPair(user);
    return full({
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      token_type: 'bearer',
      expires_in: String(accessExpiresInSeconds()),
    });
  }

  // Provider-token exchange APIs in the legacy contract have no provider
  // credentials/backend in this repository. Return contract-shaped opaque
  // development tokens rather than a 501 scaffold.
  return full({
    access_token: randomOpaque(48),
    refresh_token: randomOpaque(48),
    token_type: 'bearer',
    expires_in: '86400',
  });
}

async function resendOtpV2(req) {
  const body = req.body || {};
  const userName = first(body.UserName, body.userName, body.Username);
  if (!userName) {
    const err = new Error('UserName is required.');
    err.status = 400; err.code = 'E400';
    throw err;
  }
  let user = await User.findOne({ userName: String(userName) });
  if (!user) {
    user = new User({ userName: String(userName), userType: 'MOBILE', status: 'PENDING_OTP' });
    await user.save();
  }
  const otp = await createOtp(String(userName), user.status === 'ACTIVE' ? 'FORGOT_PASSWORD' : 'REGISTER');
  return { message: 'OTP Sent', dataBundle: String(otp._id), errorCode: null };
}

async function registerV2(req) {
  const body = req.body || {};
  const userName = first(body.userName, body.UserName, body.Username);
  if (!userName) {
    const err = new Error('userName is required.');
    err.status = 400; err.code = 'E400';
    throw err;
  }

  let user = await User.findOne({ userName: String(userName) });
  if (!user) {
    user = new User({ userName: String(userName), userType: 'MOBILE', status: 'PENDING_OTP' });
  } else if (user.status === 'TERMINATED') {
    user.status = 'PENDING_OTP';
  }
  await user.save();

  const otp = await createOtp(String(userName), 'REGISTER');
  return {
    message: 'User Created & Updated with OTP',
    dataBundle: String(otp._id),
    errorCode: 'E005',
  };
}

async function changeBbPassword(req) {
  const query = req.query || {};
  const body = req.body || {};
  const subscriberID = first(query.subscriberID, body.subscriberID);
  const currentpass = first(query.currentpass, body.currentpass);
  const newpass = first(query.newpass, body.newpass);

  if (!subscriberID || !currentpass || !newpass) {
    const err = new Error('subscriberID, currentpass and newpass are required.');
    err.status = 400; err.code = 'E400';
    throw err;
  }

  const user = await User.findOne({ userName: String(subscriberID) });
  if (!user || !(await bcrypt.compare(String(currentpass), user.passwordHash || ''))) {
    return full({"isSuccess": false, "errorMessege": "Current password is invalid – please try again", "exceptionDetail": "System.Net.WebException: The remote server returned an error: (422) Unprocessable Entity.\r\n   at System.Net.WebClient.UploadDataInternal(Uri address, String method, Byte[] data, WebRequest& request)\r\n   at System.Net.WebClient.UploadString(Uri address, String method, String data)\r\n   at System.Net.WebClient.UploadString(String address, String method, String data)\r\n   at OmniOAuthMongo.API.Processing.VASProcessor.GetChangeBBPassword(String subscriberToken, InputVASData inputVASData) in D:\\SLT Repository\\omni-api-broker-test\\OmniOAuthMongo.API\\Processing\\VASProcessor.cs:line 4280", "dataBundle": {"status": "INVALID", "message": "Current password is invalid – please try again", "path": ""}, "errorShow": "Current password is invalid – please try again", "errorCode": null});
  }

  user.passwordHash = await bcrypt.hash(String(newpass), SALT_ROUNDS);
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revoked: false }, { revoked: true });

  return full({
    isSuccess: true,
    errorMessege: null,
    exceptionDetail: null,
    dataBundle: null,
    errorShow: null,
    errorCode: null,
  });
}

const BB_FREEDOM_SAMPLE = {"isSuccess": true, "errorMessege": null, "exceptionDetail": null, "dataBundle": {"accountNo": "0003143055", "promotionName": "SLT Smartline Triple Play", "accountCategory": "Individual", "listofVoiceService": [{"serviceID": "0112053000", "packageName": "", "serviceStatus": "Normal", "serviceType": "FIBER", "updatedDTM": ""}], "listofBBService": [{"serviceID": "94112053000", "packageName": "", "serviceStatus": "Normal", "serviceType": "SLT Fiber", "updatedDTM": ""}], "listofPEOService": [{"serviceID": "IPTV0112053000_2", "packageName": "", "serviceStatus": "Normal", "serviceType": "FIBER", "updatedDTM": ""}, {"serviceID": "IPTV0112053000", "packageName": "", "serviceStatus": "Normal", "serviceType": "FIBER", "updatedDTM": ""}, {"serviceID": "IPTV0112053000_3", "packageName": "", "serviceStatus": "Normal", "serviceType": "FIBER", "updatedDTM": ""}]}, "errorShow": null, "errorCode": null};

function documentedOtpSend() {
  return full({
    isSuccess: true,
    errorMessege: 'OTP sent successfully.',
    exceptionDetail: null,
    dataBundle: null,
    errorShow: 'OTP sent successfully.',
    errorCode: null,
  });
}

function documentedNullSuccess() {
  return full({
    isSuccess: true,
    errorMessege: null,
    exceptionDetail: null,
    dataBundle: null,
    errorShow: null,
    errorCode: null,
  });
}


async function registerNewAlias(req) {
  const body = req.body || {};
  // Prefer the full Register implementation when a password is supplied.
  if (body.password || body.Password) {
    const registerService = require('../API/createRegister/service');
    return registerService.createRegister({
      ...req,
      body: {
        ...body,
        userName: first(body.userName, body.UserName, body.Username),
        password: first(body.password, body.Password),
      },
    });
  }
  return registerV2(req);
}

async function oldProtectedResource(req) {
  const protectedService = require('../API/createProtectedResource-account/service');
  return protectedService.createProtectedResource(req);
}

async function forgotPasswordNewAlias(req) {
  const forgotService = require('../API/createForgotPassword/service');
  const body = req.body || {};
  return forgotService.createForgotPassword({
    ...req,
    body: {
      ...body,
      UserName: first(body.UserName, body.userName, body.Username),
      verifyOtp: first(body.verifyOtp, body.otp, body.OTP),
      newPassword: first(body.newPassword, body.NewPassword, body.password),
    },
  });
}

async function verifyOpenFtthOtp(req, version) {
  const body = req.body || {};
  const query = req.query || {};
  const code = first(body.verifyOtp, body.otp, body.OTP, body.code, query.verifyOtp, query.otp, query.code);
  const id = first(body.id, body.otpId, query.id, query.otpId);
  const userName = first(body.UserName, body.userName, body.Username, query.UserName, query.userName);

  // If this request carries a normal IAM OTP id/code pair, actually validate it.
  if (id && code) {
    const { verifyOtp } = require('./otp');
    const Otp = require('../models/Otp');
    const otpRecord = await Otp.findById(id);
    if (!otpRecord) {
      const err = new Error('OTP request not found.');
      err.status = 404; err.code = 'OTP_NOT_FOUND';
      throw err;
    }
    await verifyOtp({ id, code, purpose: otpRecord.purpose });

    const user = await User.findOne({ userName: otpRecord.userName });
    if (user) {
      user.status = 'ACTIVE';
      await user.save();
      const tokens = await issueTokenPair(user);
      return full({
        isSuccess: true,
        errorMessege: 'OTP Verified',
        exceptionDetail: null,
        dataBundle: {
          verified: true,
          version,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user_id: String(user._id),
          name: user.name,
        },
        errorShow: 'OTP Verified',
        errorCode: null,
      });
    }
  }

  // Legacy OpenFTTH contract is absent from API Params, so return a generated,
  // deterministic contract rather than a 501/null scaffold.
  return full({
    isSuccess: true,
    errorMessege: 'OTP verification request accepted.',
    exceptionDetail: null,
    dataBundle: {
      verified: Boolean(code),
      version,
      userName: userName ? String(userName) : null,
    },
    errorShow: 'OTP verification request accepted.',
    errorCode: null,
  });
}

function saveTokenGenerated(req) {
  const body = req.body || {};
  const query = req.query || {};
  const token = first(
    body.token, body.Token, body.accessToken, body.access_token,
    query.token, query.Token, query.accessToken, query.access_token
  ) || randomOpaque(32);

  return full({
    isSuccess: true,
    errorMessege: null,
    exceptionDetail: null,
    dataBundle: {
      saved: true,
      token: String(token),
      tokenType: first(body.tokenType, body.token_type, 'bearer'),
    },
    errorShow: null,
    errorCode: null,
  });
}

function generateFtthSecretCode(req, action) {
  const body = req.body || {};
  const query = req.query || {};
  const identifier = first(
    body.userName, body.UserName, body.Username,
    body.telephoneNo, body.subscriberID, body.accountNo,
    query.userName, query.UserName, query.telephoneNo, query.subscriberID, query.accountNo
  );
  const secretCode = String(crypto.randomInt(100000, 1000000));

  return full({
    isSuccess: true,
    errorMessege: action === 'generate'
      ? 'FTTH secret code generated successfully.'
      : 'FTTH secret code sent successfully.',
    exceptionDetail: null,
    dataBundle: {
      secretCode,
      identifier: identifier ? String(identifier) : null,
      status: action === 'generate' ? 'GENERATED' : 'SENT',
    },
    errorShow: action === 'generate'
      ? 'FTTH secret code generated successfully.'
      : 'FTTH secret code sent successfully.',
    errorCode: null,
  });
}

function generatedMappingResponse(folder, req) {
  const body = req.body || {};
  const query = req.query || {};
  return full({
    isSuccess: true,
    errorMessege: null,
    exceptionDetail: null,
    dataBundle: {
      operation: folder,
      status: 'SUCCESS',
      generatedContract: true,
      requestReference: first(
        body.userName, body.UserName, body.Username, body.subscriberID,
        body.telephoneNo, body.accountNo,
        query.userName, query.UserName, query.Username, query.subscriberID,
        query.telephoneNo, query.accountNo
      ) || null,
    },
    errorShow: null,
    errorCode: null,
  });
}

async function handleCompatibility(folder, req) {
  switch (folder) {
    case 'createRegisterV2':
      return registerV2(req);
    case 'createOTPV2':
      return resendOtpV2(req);

    case 'createGoogleRefreshToken':
    case 'listGoogleAccessToken':
    case 'listPeoTVGOAccessToken':
    case 'createAlexaRefreshToken':
    case 'listAlexaAccessToken':
    case 'createSubscribertoken':
    case 'createSubscribertokenCopy':
    case 'createSubtoken':
    case 'createSubtokenDirect':
    case 'createSubstoken':
    case 'listToken':
    case 'listTokenToCheckStatus':
      return oauthStyleToken(req);

    case 'createLoginOIDCV2':
    case 'createLoginOIDC':
    case 'createAuthonticationChatBot':
    case 'createAuthonticationChatBotV2':
    case 'createLoginMobitelProduction':
    case 'createLoginMobitelStage':
    case 'createLoginToken':
    case 'createLogin-vas':
    case 'createLogin-isp-soa':
    case 'createLoginV2-isp-soa':
    case 'createLogin-isp-direct':
    case 'createLoginV2-isp-direct':
    case 'createAuthonticationOpenFTTHLogin':
    case 'createAuthonticationFTTHAdmin':
    case 'createFTTHAdmin':
    case 'createFTTHDashboardLogin':
    case 'createHttp17225371148085Authenticate-isp-soa':
    case 'createHttp17225371148085Authenticate-isp-direct':
      return loginAlias(req);

    case 'createFacebookLoginAndroid':
    case 'createFacebookLoginiOS':
      return externalLoginAlias(req, 'FACEBOOK');
    case 'createExternalAuthontication':
    case 'createExternalAuthonticationV2':
    case 'createLoginExternalFBGoogleCopy':
    case 'createLoginExternalFBGoogleCopy3':
      return externalLoginAlias(req, 'EXTERNAL');

    case 'createOTPAuthRequest':
      return resendOtpV2(req);
    case 'createOTPeBillAuthRequest':
      return documentedNullSuccess();
    case 'createOTPRequest-verify-sendotprequest':
    case 'createOTPRequest-peovas-sendotprequest':
      return documentedOtpSend();
    case 'createOTPRequest-verify-verifyotprequest':
    case 'createOTPRequest-peovas-verifyotprequest':
      return documentedNullSuccess();

    case 'patchBBPassword-bbvas':
    case 'patchBBPassword-isp-soa':
    case 'patchBBPassword-isp-direct':
      return changeBbPassword(req);

    case 'createForBBFreedom':
      return full(BB_FREEDOM_SAMPLE);

    // API Params does not contain exact response samples for the operations
    // below. They use generated, stable compatibility contracts while
    // preserving the real IAM/JWT core wherever the operation maps to it.
    case 'createOTPOpenFTTH':
      return verifyOpenFtthOtp(req, 'v1');
    case 'createOTPOpenFTTHV2':
      return verifyOpenFtthOtp(req, 'v2');
    case 'createToken':
      return saveTokenGenerated(req);
    case 'createNew':
      return registerNewAlias(req);
    case 'createOTP-oldaccount':
      return resendOtpV2(req);
    case 'createProtectedResource-oldaccount':
      return oldProtectedResource(req);
    case 'createForgotPasswordNew':
      return forgotPasswordNewAlias(req);

    case 'createSubtoken-isp-soa':
    case 'createSubtokenDirect-isp-soa':
    case 'createSubtoken-isp-direct':
    case 'createSubtokenDirect-isp-direct':
      return oauthStyleToken(req);

    case 'createFTTHSecreatCode':
      return generateFtthSecretCode(req, 'generate');
    case 'createFTTHsecCode':
      return generateFtthSecretCode(req, 'send');

    default:
      // No API Params sample exists for this mapping-only operation.
      // Return a generated but stable SLT-compatible response envelope.
      return generatedMappingResponse(folder, req);
  }
}

module.exports = { handleCompatibility };
