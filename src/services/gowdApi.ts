/**
 * Gowd MCP — API Client (standalone)
 *
 * Autenticacao: mTLS (PFX) + Azure Entra token (POST /auth/v1/token)
 * Reimplementa a logica de auth e chamadas HTTP de forma independente.
 */

import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as fs from 'fs';

import { GOWD_DEFAULT_BASE_URL, TOKEN_BUFFER_MS } from '../constants.js';

// ── Env ──────────────────────────────────────────────────────────────────────

function getEnv(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim();
}

function getBoolEnv(key: string, fallback = false): boolean {
  const v = getEnv(key, String(fallback));
  return v === 'true' || v === '1';
}

// ── Config helpers ───────────────────────────────────────────────────────────

interface GowdConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  pfxPath: string;
  pfxBase64: string;
  pfxPassphrase: string;
}

function loadConfig(): GowdConfig {
  const scopesEnv = getEnv('GOWD_SCOPES');
  return {
    baseUrl: getEnv('GOWD_BASE_URL', GOWD_DEFAULT_BASE_URL).replace(/\/+$/, ''),
    clientId: getEnv('GOWD_CLIENT_ID'),
    clientSecret: getEnv('GOWD_CLIENT_SECRET'),
    scopes: scopesEnv ? scopesEnv.split(',').map((s) => s.trim()).filter(Boolean) : [],
    pfxPath: getEnv('GOWD_MTLS_PFX_PATH'),
    pfxBase64: getEnv('GOWD_MTLS_PFX_BASE64').replace(/\s/g, ''),
    pfxPassphrase: getEnv('GOWD_MTLS_PFX_PASSPHRASE'),
  };
}

function isConfigured(cfg: GowdConfig): boolean {
  if (!cfg.baseUrl) return false;
  return Boolean(cfg.clientId && cfg.clientSecret);
}

// ── mTLS Agent ───────────────────────────────────────────────────────────────

let _agent: https.Agent | undefined;

function getAgent(cfg: GowdConfig): https.Agent | undefined {
  if (_agent !== undefined) return _agent;

  if (cfg.pfxBase64) {
    const pfx = Buffer.from(cfg.pfxBase64, 'base64');
    _agent = new https.Agent({
      pfx,
      passphrase: cfg.pfxPassphrase || undefined,
      rejectUnauthorized: true,
    });
  } else if (cfg.pfxPath) {
    const pfx = fs.readFileSync(cfg.pfxPath);
    _agent = new https.Agent({
      pfx,
      passphrase: cfg.pfxPassphrase || undefined,
      rejectUnauthorized: true,
    });
  }

  return _agent;
}

// ── Token cache ──────────────────────────────────────────────────────────────

interface TokenCache {
  value: string;
  expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

async function getToken(cfg: GowdConfig): Promise<string> {
  const now = Date.now();
  if (_tokenCache && now < _tokenCache.expiresAt - TOKEN_BUFFER_MS) {
    return _tokenCache.value;
  }

  const agent = getAgent(cfg);

  const res = await axios.post(
    `${cfg.baseUrl}/auth/v1/token`,
    {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      scopes: cfg.scopes.length > 0 ? cfg.scopes : [`api://${cfg.clientId}/.default`],
    },
    {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
    },
  );

  const token = res.data?.token as string | undefined;
  const expiresIn = Number(res.data?.expiresIn ?? 3600);

  if (!token) throw new Error('Gowd auth failed: no token');

  _tokenCache = { value: token, expiresAt: now + expiresIn * 1000 };
  return token;
}

// ── Authenticated client ─────────────────────────────────────────────────────

async function client(cfg: GowdConfig): Promise<AxiosInstance> {
  const token = await getToken(cfg);
  const agent = getAgent(cfg);

  return axios.create({
    baseURL: cfg.baseUrl,
    httpsAgent: agent,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

// ── Error handler ────────────────────────────────────────────────────────────

export function handleApiError(error: any): string {
  if (error.response) {
    const { status, data } = error.response;
    return `Gowd API error ${status}: ${JSON.stringify(data ?? error.message)}`;
  }
  if (error.request) {
    return `Gowd API: sem resposta do servidor — ${error.message}`;
  }
  return `Gowd API: ${error.message}`;
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) return false;
  try {
    await getToken(cfg);
    return true;
  } catch {
    return false;
  }
}

// ── Balance ──────────────────────────────────────────────────────────────────

export async function getBalance() {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) throw new Error('Gowd nao configurado');
  const api = await client(cfg);
  const res = await api.get('/banking/v1/balance');
  return res.data as { available: number; pending: number };
}

// ── Payin ────────────────────────────────────────────────────────────────────

export async function createPayin(
  amountBrl: number,
  params: {
    payerDocument: string;
    payerName: string;
    payerPersonType: number;
    description?: string;
    userId?: string;
  },
) {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) throw new Error('Gowd nao configurado');
  const api = await client(cfg);

  const code = `ashar-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const expiration = 1800;

  const body: Record<string, unknown> = {
    code,
    amount: { currency: 'BRL', value: amountBrl.toFixed(2) },
    expiration,
    description: params.description || `Ashar - R$ ${amountBrl.toFixed(2)}`,
    ...(params.userId ? { metadata: { asharUserId: params.userId } } : {}),
  };

  const res = await api.post('/banking/v1/payin', body);
  return res.data as {
    id: string;
    code: string;
    status: string;
    pixCopyPaste?: string;
    pixQrCode?: string;
    expiresAt?: string;
  };
}

export async function queryPayin(code: string) {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) throw new Error('Gowd nao configurado');
  const api = await client(cfg);
  const res = await api.get(`/banking/v1/payin/${encodeURIComponent(code)}`);
  return res.data as {
    id: string;
    code: string;
    status: string;
    pixCopyPaste?: string;
    amount: { currency: string; value: string };
  };
}

// ── Payout ───────────────────────────────────────────────────────────────────

export async function createPayout(params: {
  keyValue: string;
  keyType: string;
  document: string;
  amount: number;
  description?: string;
  receiverName?: string;
}) {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) throw new Error('Gowd nao configurado');
  const api = await client(cfg);

  const code = `ashar-out-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const docClean = params.document.replace(/\D/g, '');
  const docType = docClean.length === 11 ? 'CPF' : 'CNPJ';

  const body: Record<string, unknown> = {
    code,
    amount: { currency: 'BRL', value: params.amount.toFixed(2) },
    receiver: {
      name: params.receiverName || params.description || 'Ashar saque',
      document: { type: docType, number: docClean },
      pix: { type: params.keyType.toUpperCase(), key: params.keyValue },
    },
    description: params.description || 'Ashar saque',
  };

  const res = await api.post('/banking/v1/payout', body);
  return res.data as { id: string; code: string; status: string; endToEndId?: string };
}

export async function queryPayout(code: string) {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) throw new Error('Gowd nao configurado');
  const api = await client(cfg);
  const res = await api.get(`/banking/v1/payout/${encodeURIComponent(code)}`);
  return res.data as { id: string; code: string; status: string; endToEndId?: string };
}
