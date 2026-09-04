import * as client from 'openid-client'

/**
 * Integración OIDC genérica: funciona contra cualquier proveedor que cumpla el estándar
 * (Microsoft Entra ID, Google, Okta, Auth0, Keycloak...) por descubrimiento automático de sus
 * endpoints a partir de `OIDC_ISSUER_URL` — no hay código específico de ningún proveedor.
 * Si esas variables no están configuradas, el login local (usuario/clave) sigue funcionando
 * igual; esta integración queda simplemente deshabilitada.
 */

let configPromise: Promise<client.Configuration> | null = null

export function isOidcConfigured(): boolean {
  return !!process.env.OIDC_ISSUER_URL && !!process.env.OIDC_CLIENT_ID && !!process.env.OIDC_REDIRECT_URI
}

async function getConfig(): Promise<client.Configuration> {
  if (!isOidcConfigured()) throw new Error('OIDC no está configurado (faltan variables de entorno)')
  if (!configPromise) {
    configPromise = client.discovery(
      new URL(process.env.OIDC_ISSUER_URL!),
      process.env.OIDC_CLIENT_ID!,
      process.env.OIDC_CLIENT_SECRET || undefined
    )
  }
  return configPromise
}

export function randomCodeVerifier(): string {
  return client.randomPKCECodeVerifier()
}

export function codeChallengeFor(codeVerifier: string): Promise<string> {
  return client.calculatePKCECodeChallenge(codeVerifier)
}

export async function getAuthorizationUrl(state: string, codeChallenge: string): Promise<string> {
  const config = await getConfig()
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: process.env.OIDC_REDIRECT_URI!,
    scope: process.env.OIDC_SCOPES || 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })
  return url.href
}

export interface OidcIdentity {
  email: string
  nombre?: string
}

/** Intercambia el código de autorización y devuelve la identidad confirmada por el proveedor. */
export async function exchangeCode(
  callbackUrl: URL,
  codeVerifier: string,
  expectedState: string
): Promise<OidcIdentity> {
  const config = await getConfig()
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
  })
  const claims = tokens.claims()
  const email = claims?.email
  if (typeof email !== 'string' || !email) {
    throw new Error('El proveedor de identidad no devolvió un correo electrónico')
  }
  const nombre = typeof claims?.name === 'string' ? claims.name : undefined
  return { email, nombre }
}
