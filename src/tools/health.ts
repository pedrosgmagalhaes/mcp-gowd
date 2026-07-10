/**
 * Gowd MCP — Health Check Tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HealthInputSchema, ResponseFormat } from '../types.js';
import { healthCheck, handleApiError } from '../services/gowdApi.js';

const CHARACTER_LIMIT = 25_000;

export function registerHealthTools(server: McpServer) {
  server.registerTool(
    'gowd_health',
    {
      title: 'Health Check Gowd',
      description: `Verifica a conectividade com a API da Gowd.

Tenta autenticar via Azure Entra para confirmar que as credenciais e o mTLS (PFX) estao funcionando.

Args:
  - response_format ('markdown' | 'json')

Returns (JSON):
  { "connected": true | false, "message": "..." }

Exemplos:
  - "A conexao com a Gowd esta funcionando?"
  - "Testa a autenticacao na Gowd"`,
      inputSchema: HealthInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const ok = await healthCheck();
        const output = {
          connected: ok,
          message: ok
            ? 'Conectado a Gowd — autenticacao OK'
            : 'Falha na autenticacao com Gowd',
          timestamp: new Date().toISOString(),
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text = ok
            ? '✅ **Gowd conectado** — autenticacao via Azure Entra + mTLS funcionando.'
            : '❌ **Falha de conexao com Gowd** — verifique credenciais e certificado PFX.';
        } else {
          text = JSON.stringify(output, null, 2);
        }

        return {
          content: [{ type: 'text', text: text.slice(0, CHARACTER_LIMIT) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: 'text', text: handleApiError(error) }] };
      }
    },
  );
}
