import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { StoredCredential } from './enrollment';
import { siteOrigin } from './runtime';

// A single fixed account: this dashboard only ever has one owner.
const OWNER_ID = new TextEncoder().encode('portfolio-owner');
const relyingParty = () => {
  const origin = siteOrigin();
  return { origin, id: new URL(origin).hostname };
};

export function registrationOptions(existing: StoredCredential[]) {
  return generateRegistrationOptions({
    rpName: 'Parth Jadhav portfolio',
    rpID: relyingParty().id,
    userID: OWNER_ID,
    userName: 'owner',
    userDisplayName: 'Parth',
    attestationType: 'none',
    excludeCredentials: existing.map((credential) => ({ id: credential.id, transports: credential.transports as AuthenticatorTransport[] })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
}

export async function verifyRegistration(response: unknown, expectedChallenge: string) {
  const { origin, id } = relyingParty();
  const result = await verifyRegistrationResponse({
    response: response as RegistrationResponseJSON,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: id,
    requireUserVerification: true,
  });
  return result.verified && result.registrationInfo ? result.registrationInfo.credential : null;
}

/** No credential IDs are listed, so an anonymous visitor learns nothing about the owner's passkeys. */
export function loginOptions() {
  return generateAuthenticationOptions({ rpID: relyingParty().id, userVerification: 'required', allowCredentials: [] });
}

export async function verifyLogin(response: unknown, expectedChallenge: string, credential: StoredCredential) {
  const { origin, id } = relyingParty();
  return verifyAuthenticationResponse({
    response: response as AuthenticationResponseJSON,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: id,
    requireUserVerification: true,
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransport[],
    },
  });
}
