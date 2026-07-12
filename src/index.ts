#!/usr/bin/env node
/**
 * Gowd BaaS MCP Server
 *
 * MCP server que expoe operacoes da conta Gowd:
 *   - Saldo
 *   - Payin PIX (receber)
 *   - Payout PIX (enviar)
 *   - Health check
 *
 * Autenticacao: mTLS (PFX) + Azure Entra token (POST /auth/v1/token).
 * Transport: stdio (local) ou HTTP (remoto/Railway).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

import { registerBalanceTools } from './tools/balance.js';
import { registerPayinTools } from './tools/payin.js';
import { registerPayoutTools } from './tools/payout.js';
import { registerHealthTools } from './tools/health.js';
import { logger, registerUnhandledErrorHandlers } from './utils/logger.js';

// Register global unhandled error handlers early
registerUnhandledErrorHandlers();

// ── Validate config ────────────────────────────────────────────────────────

function validateConfig(): void {
  const issues: string[] = [];
  const transport = getTransport();

  if (transport === 'http') {
    if (!process.env.GOWD_CLIENT_ID) issues.push('GOWD_CLIENT_ID is required');
    if (!process.env.GOWD_CLIENT_SECRET) issues.push('GOWD_CLIENT_SECRET is required');
  }

  if (issues.length > 0) {
    logger.warn('Configuration errors', { issues });
    if (transport === 'http') {
      process.exit(1);
    }
    logger.warn('Continuing in degraded mode (some tools will return config errors)');
  }
}

function getTransport(): string {
  return (process.env.GOWD_TRANSPORT || process.env.ASHAR_TRANSPORT || 'stdio').trim();
}

// ── Create MCP server ──────────────────────────────────────────────────────

const server = new McpServer({
  name: 'gowd-mcp-server',
  version: '1.0.0',
});

registerBalanceTools(server);
registerPayinTools(server);
registerPayoutTools(server);
registerHealthTools(server);

// ── stdio transport ─────────────────────────────────────────────────────────

async function runStdio(): Promise<void> {
  validateConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server running via stdio');
}

// ── HTTP transport (Railway) ────────────────────────────────────────────────

async function runHttp(): Promise<void> {
  validateConfig();

  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', name: 'gowd-mcp-server', version: '1.0.0' });
  });

  const port = parseInt(process.env.PORT || '3002', 10);
  app.listen(port, () => {
    logger.info('MCP server running via HTTP', { port });
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────

const transport = getTransport();

if (transport === 'http') {
  runHttp().catch((error) => {
    logger.fatal('Fatal error — process will exit', error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    logger.fatal('Fatal error — process will exit', error);
    process.exit(1);
  });
}
