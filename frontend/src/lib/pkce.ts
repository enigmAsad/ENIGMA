
/**
 * Generates a random string for the PKCE code verifier.
 * @param length The length of the string to generate.
 * @returns A random string.
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Hashes the code verifier using SHA-256.
 * @param code_verifier The code verifier string.
 * @returns A promise that resolves to the SHA-256 hash.
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

/**
 * Base64-URL encodes the given buffer.
 * @param buffer The buffer to encode.
 * @returns The Base64-URL encoded string.
 */
function base64urlencode(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Creates a new PKCE code verifier.
 * @returns A new code verifier.
 */
export function createCodeVerifier(): string {
    return generateRandomString(128);
}

/**
 * Creates a PKCE code challenge from a code verifier.
 * @param verifier The code verifier.
 * @returns A promise that resolves to the code challenge.
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
}
