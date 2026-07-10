/**
 * Gowd MCP — Payin Tool (PIX recebido)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PayinCreateInputSchema, PayinQueryInputSchema, ResponseFormat } from '../types.js';
import { createPayin, queryPayin, handleApiError } from '../services/gowdApi.js';

const CHARACTER_LIMIT = 25_000;

export function registerPayinTools(server: McpServer) {
  // ── Criar Payin ──────────────────────────────────────────────────────────

  server.registerTool(
    'gowd_criar_payin',
    {
      title: 'Criar Payin PIX na Gowd',
      description: `Cria uma ordem de recebimento PIX (payin) na Gowd.

Gera um QR code PIX para o pagador realizar o deposito.

Args:
  - amount_brl: Valor em reais (ex: 100.50)
  - payer_document: CPF ou CNPJ do pagador
  - payer_name: Nome completo do pagador
  - payer_person_type: 0 = PF, 1 = PJ (default: 0)
  - description: Descricao opcional
  - user_id: ID do usuario Ashar associado (opcional)
  - response_format ('markdown' | 'json')

Returns (JSON):
  { "code", "status", "pix_copy_paste", "pix_qr_code", "expires_at" }

Exemplos:
  - "Cria um PIX de R$ 100 para o CPF 12345678901"
  - "Gera QR code PIX de 50 reais na Gowd"`,
      inputSchema: PayinCreateInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await createPayin(params.amount_brl, {
          payerDocument: params.payer_document,
          payerName: params.payer_name,
          payerPersonType: params.payer_person_type,
          description: params.description,
          userId: params.user_id,
        });

        const output = {
          code: result.code,
          status: result.status,
          pix_copy_paste: result.pixCopyPaste || result.pixQrCode || '',
          pix_qr_code: result.pixQrCode || null,
          gowd_order_id: result.id,
          expires_at: result.expiresAt || null,
          timestamp: new Date().toISOString(),
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text =
            `📥 **Payin PIX criado na Gowd**\n\n` +
            `| Campo | Valor |\n|-------|-------|\n` +
            `| Codigo | \`${output.code}\` |\n` +
            `| Status | ${output.status} |\n` +
            `| PIX Copia e Cola | \`${output.pix_copy_paste.slice(0, 60)}…\` |\n` +
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

  // ── Consultar Payin ──────────────────────────────────────────────────────

  server.registerTool(
    'gowd_consultar_payin',
    {
      title: 'Consultar Payin PIX na Gowd',
      description: `Consulta uma ordem de recebimento PIX (payin) pelo codigo externo.

Args:
  - code: Codigo externo da ordem
  - response_format ('markdown' | 'json')

Returns (JSON):
  { "id", "code", "status", "amount" }

Exemplos:
  - "Qual o status do payin ashar-abc123?"
  - "Consulta a ordem de recebimento na Gowd"`,
      inputSchema: PayinQueryInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await queryPayin(params.code);

        const output = {
          code: result.code,
          status: result.status,
          gowd_order_id: result.id,
          amount: result.amount,
          timestamp: new Date().toISOString(),
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text =
            `📥 **Payin \`${result.code}\`**\n\n` +
            `| Campo | Valor |\n|-------|-------|\n` +
            `| Status | ${result.status} |\n` +
            `| Valor | ${result.amount?.currency ?? 'BRL'} ${result.amount?.value ?? '?'} |\n` +
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
