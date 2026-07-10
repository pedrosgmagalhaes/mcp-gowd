/**
 * Gowd MCP — Payout Tool (PIX enviado)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PayoutCreateInputSchema, PayoutQueryInputSchema, ResponseFormat } from '../types.js';
import { createPayout, queryPayout, handleApiError } from '../services/gowdApi.js';

const CHARACTER_LIMIT = 25_000;

export function registerPayoutTools(server: McpServer) {
  // ── Criar Payout ─────────────────────────────────────────────────────────

  server.registerTool(
    'gowd_criar_payout',
    {
      title: 'Criar Payout PIX na Gowd',
      description: `Envia um PIX (payout) pela Gowd.

Transfere BRL da conta Ashar na Gowd para uma chave PIX de destino.

Args:
  - pix_key_value: Chave PIX de destino (CPF, CNPJ, email, telefone, EVP)
  - pix_key_type: Tipo da chave: CPF, CNPJ, EMAIL, PHONE, EVP
  - amount_brl: Valor a enviar em reais (ex: 50.00)
  - receiver_document: CPF ou CNPJ do recebedor
  - receiver_name: Nome do recebedor (opcional)
  - description: Descricao opcional
  - response_format ('markdown' | 'json')

Returns (JSON):
  { "code", "status", "gowd_order_id", "end_to_end_id" }

Exemplos:
  - "Envia R$ 50 para a chave PIX 12345678901"
  - "Faz um PIX de 100 reais para joao@email.com"`,
      inputSchema: PayoutCreateInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await createPayout({
          keyValue: params.pix_key_value,
          keyType: params.pix_key_type,
          document: params.receiver_document,
          amount: params.amount_brl,
          description: params.description,
          receiverName: params.receiver_name,
        });

        const output = {
          code: result.code,
          status: result.status,
          gowd_order_id: result.id,
          end_to_end_id: result.endToEndId || null,
          timestamp: new Date().toISOString(),
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text =
            `📤 **Payout PIX enviado na Gowd**\n\n` +
            `| Campo | Valor |\n|-------|-------|\n` +
            `| Codigo | \`${output.code}\` |\n` +
            `| Status | ${output.status} |\n` +
            `| Valor | R$ ${params.amount_brl.toFixed(2)} |\n` +
            `| Destino | ${params.pix_key_value} |\n` +
            `| Gowd Order ID | \`${output.gowd_order_id}\` |`;
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

  // ── Consultar Payout ─────────────────────────────────────────────────────

  server.registerTool(
    'gowd_consultar_payout',
    {
      title: 'Consultar Payout PIX na Gowd',
      description: `Consulta uma ordem de envio PIX (payout) pelo codigo externo.

Args:
  - code: Codigo externo da ordem
  - response_format ('markdown' | 'json')

Returns (JSON):
  { "id", "code", "status", "end_to_end_id" }

Exemplos:
  - "Qual o status do payout ashar-out-abc123?"
  - "O PIX que enviei ja foi confirmado?"`,
      inputSchema: PayoutQueryInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await queryPayout(params.code);

        const output = {
          code: result.code,
          status: result.status,
          gowd_order_id: result.id,
          end_to_end_id: result.endToEndId || null,
          timestamp: new Date().toISOString(),
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text =
            `📤 **Payout \`${result.code}\`**\n\n` +
            `| Campo | Valor |\n|-------|-------|\n` +
            `| Status | ${result.status} |\n` +
            `| EndToEnd | \`${result.endToEndId || '—'}\` |\n` +
            `| Gowd Order ID | \`${result.id}\` |`;
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
