/** The browser side of signing in and adding a passkey. The private key never leaves the device. */
export async function post<T = unknown>(url: string, body: unknown = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? 'Something went wrong. Try again.');
  return data as T;
}

export function explain(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Cancelled, or the device said no. Try again when you\'re ready.';
    if (error.name === 'InvalidStateError') return 'This device already has a passkey for this site.';
    return 'Your device couldn\'t complete that. Try again, or try another browser.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

function assertSupported(): void {
  if (!window.PublicKeyCredential || !('parseRequestOptionsFromJSON' in PublicKeyCredential)) {
    throw new Error('This browser is too old for passkeys. Update it, or use a current Chrome, Edge, Safari or Firefox.');
  }
}

export async function signIn(): Promise<void> {
  assertSupported();
  const options = await post<PublicKeyCredentialRequestOptionsJSON>('/api/auth/login/options');
  const credential = await navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options) }) as PublicKeyCredential | null;
  if (!credential) throw new Error('Sign-in failed. Try again.');
  await post('/api/auth/login/verify', { response: credential.toJSON() });
}

export async function createPasskey(label: string, token?: string): Promise<void> {
  assertSupported();
  const options = await post<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/options', { token });
  const credential = await navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options) }) as PublicKeyCredential | null;
  if (!credential) throw new Error('That passkey could not be saved. Try again.');
  await post('/api/auth/register/verify', { response: credential.toJSON(), label, token });
}
