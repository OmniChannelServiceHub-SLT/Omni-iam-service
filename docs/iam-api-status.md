# IAM API Status

Status is based on the current local code, not folder presence or remote branch claims. Provider/business operations without a verified integration remain explicit fail-closed boundaries. No live provider calls, real-account changes, or Gateway end-to-end tests were run.

| API | Local status | Remaining blocker / note |
| --- | --- | --- |
| Login | Implemented; untested against isolated MongoDB | Login-specific durable failed-attempt control is not implemented. |
| TerminateProfile | Implemented; MongoDB workflow not integration-tested | Own-account soft termination, token-version increment and session/OTP revocation are transactional. |
| OTPAuthRequest | Implemented; mocked transaction paths tested | Challenge consume, pending-user activation, and initial refresh-token insert are transactional. There is no documented password-setup flow. |
| refreshToken | Implemented; mocked concurrency/failure-tested | Token consume and replacement insert run in a transaction; active status/tokenVersion are checked and a user-document write fence serializes against auth changes. Legacy UTC date string format uses runtime values. |
| ChangePassword | Implemented; MongoDB workflow not integration-tested | Password update, token-version increment, and refresh/OTP revocation are transactional. |
| ForgotPassword | Route/service implemented; not usable end-to-end | Recovery OTP issuance is deliberately unavailable; no public recovery bypass was added. |
| LoginExternal | Fail-closed route implemented and locally tested | Apple/Google/Facebook verifier, issuer/audience/nonce configuration and provider-subject mapping are not configured. |
| OTPeBillAuthRequest | Local development workflow; transaction logic mocked | Requires local WORKFLOW_OTP from SendOTPRequest; unique match and latest-pointer claim are transactional; does not complete eBill enrollment. |
| CallVoiceOTPRequest | Fail-closed route implemented | Authorized account lookup and voice delivery are not configured. |
| AddAccountVoiceOTPRequest | Verification logic transaction-backed; MongoDB workflow untested | Current challenge claim/consumption is scoped to authenticated user/contact. Voice challenge issuance, real resultData and confirmed account-linking effect remain unavailable. |
| ResendVoiceOTPRequest | Fail-closed route implemented | Voice challenge invalidation/resend/delivery integration is unavailable. |
| SendOTPRequest | Local development workflow; concurrency logic mocked | Only eBill/MOBILE in explicit development OTP mode; durable latest-pointer/cooldown and delivery integration/requestPeriod semantics remain to verify. |
| VerifyOTPRequest | Local development workflow; transaction logic mocked | Latest pointer claim and consumption are transactional; bearer policy follows selected A37/A38 policy despite duplicate-record conflict. |
| RegisterForBBFreedom | Fail-closed route implemented | Provider account lookup, registration effect, and correct response contract need confirmation. |
| ChangeBBPassword | Provider adapter boundary implemented; untested | Requires fixed provider adapter configuration, authorization, successful-response contract, and backend credentials. |
| RegisterV2 | Local development flow implemented; untested | OTP delivery is development-only; V2 credential setup/lifecycle remains unresolved. |
| ResendOTPV2 | Local development flow implemented; MongoDB workflow not integration-tested | Pending registration only; durable cooldown applies; does not issue recovery-purpose OTPs. |
| GetPeoTVGOAccessToken | Provider adapter boundary implemented; untested | Requires confirmed provider contract, fixed adapter configuration, credentials, and real authorization-code redemption. |
| GetGoogleAccessToken | Gateway-only fail-closed route implemented and locally tested | Google wrapper-code semantics and Gateway GET-with-body compatibility/provider redemption are unconfirmed. No legacy alias is added. |

## Focused Checks

Run from the repository root:

```powershell
npm test
node --test tests/login-external.test.js
```

The focused route suite verifies LoginExternal fail-closed behavior, the Google Gateway GET-body route and missing legacy path, and the refresh UTC formatter. It does not exercise MongoDB-backed flows.

`tests/auth-concurrency.test.js` contains explicitly mocked persistence tests for simultaneous OTP issue/verification, stale and wrong-scope challenges, expiry/attempt/purpose checks, refresh rotation races and injected persistence failure, and token-version/termination rejection. `MOCK` in test names means database behavior is simulated; these are not MongoDB integration tests and do not prove driver/topology behavior.

## MongoDB Requirements

OTP issuance uses the `OtpIssuanceLock` collection with a unique `scopeKey` index and a TTL index. Startup initializes these indexes. The atomic upsert treats a duplicate-key race as the cooldown response. Verification and refresh/password/termination/activation state changes use MongoDB transactions, with snapshot read concern and majority write concern. The deployment must support transactions (replica set or sharded cluster); standalone MongoDB receives a sanitized `503 TRANSACTIONS_REQUIRED`. The configured local connection was observed as an Atlas sharded cluster with logical sessions, but no state-changing database integration test was run.

## Local Run

Configure the existing environment variables `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_EXPIRES_IN`; configure `OTP_HASH_SECRET` and delivery-adapter variables only for the corresponding flows. Never put real secrets in this document or the Postman collection. Start with:

```powershell
npm start
```

The Gateway base URL is `http://localhost:8080/internal-api/iam/v4`. Postman requests are in [Omni IAM Interim APIs.postman_collection.json](Omni%20IAM%20Interim%20APIs.postman_collection.json). Set `iamAccessToken` from the `accessToken` field in a local Login or OTPAuthRequest response; set `refreshToken` from the corresponding token response. For RegisterV2, take the challenge ID from its string `dataBundle`, and only in explicitly enabled development mode take the matching registration OTP from the server's `[LOCAL OTP ONLY]` log. For SendOTPRequest, use the generated code from `[LOCAL WORKFLOW OTP ONLY]`; `telephoneNo`, `otpContact`, and `econtact` must match the test challenge's supplied values. OTP query values are sensitive and should only be used with an isolated local test account.

There is currently no supported source for a FORGOT_PASSWORD OTP, voice OTP, verified voice `resultData`, broadband account/subscriber authority, external identity token, PEO TV GO authorization code, or Google wrapper code. Those requests cannot be turned into successful live flows using sample placeholders. Provider client credentials must come from the provider's authorized configuration, not the collection. Automated tests use mocked persistence and do not send messages or alter provider accounts.

## Confirmations Needed

- Provider verification contracts and authorized client configuration for supported external providers; especially what `externalAccessToken2` means.
- Recovery OTP issuance/delivery contract and any rate limits.
- Voice delivery/account-lookup/linking effects and the source of AddAccountVoiceOTPRequest `dataBundle`.
- RegisterForBBFreedom's real enrollment action and success response.
- Broadband adapter authorization and successful ChangeBBPassword envelope.
- PEO TV GO provider token-exchange protocol; Google wrapper code meaning and Gateway preservation of a GET body.
- Registration V2 credential setup and the intended authentication policy for duplicate A132/A133 records.