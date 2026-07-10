/**
 * Gowd MCP — Balance Tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BalanceInputSchema, ResponseFormat } from '../types.js';
import { getBalance, handleApiError } from '../services/gowdApi.js';

const CHARACTER_LIMIT = 25_000;

export function registerBalanceTools(server: McpServer) {
  server.registerTool(
    'gowd_saldo',
    {
      title: 'Saldo Gowd',
      description: `Consulta o saldo da conta Ashar na Gowd.

Retorna o saldo disponivel e pendente em BRL.

Args:
  - response_format ('markdown' | 'json')

Returns (JSON):
  { "available": 1000.00, "pending": 50.00, "currency": "BRL" }

Exemplos:
  - "Qual o saldo na Gowd?"
  - "Consulta o saldo da conta Gowd"`,
      inputSchema: BalanceInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const balance = await getBalance();
        const output = {
          available: balance.available ?? 0,
          pending: balance.pending ?? 0,
          currency: 'BRL',
          timestamp: new Date().toISOString(),
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text =
            `💰 **Saldo Gowd**\n\n` +
            `| Tipo | Valor |\n|------|-------|\n` +
            `| Disponivel | R$ ${output.available.toFixed(2)} |\n` +
            `| Pendente | R$ ${output.pending.toFixed(2)} |`;
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
