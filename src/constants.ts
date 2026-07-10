/**
 * Gowd MCP — Constants
 */

/** Gowd BaaS API base URL */
export const GOWD_DEFAULT_BASE_URL = 'https://mtls-api-platform.gowd.com';

/** Default order expiration in seconds (30 min) */
export const DEFAULT_EXPIRATION = 1800;

/** Auth token cache buffer (refresh 5 min before expiry) */
export const TOKEN_BUFFER_MS = 300_000;

/** Max characters in text response */
export const CHARACTER_LIMIT = 25_000;
