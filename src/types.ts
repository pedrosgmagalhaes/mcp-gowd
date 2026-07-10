/**
 * Gowd MCP — Zod Schemas & Types
 */

import { z } from 'zod';

// ── Response Format ──────────────────────────────────────────────────────────

export const ResponseFormat = {
  MARKDOWN: 'markdown',
  JSON: 'json',
} as const;

export const responseFormatSchema = z
  .enum([ResponseFormat.MARKDOWN, ResponseFormat.JSON])
  .default(ResponseFormat.JSON);

// ── Health ───────────────────────────────────────────────────────────────────

export const HealthInputSchema = z.object({
  response_format: responseFormatSchema,
});

// ── Balance ──────────────────────────────────────────────────────────────────

export const BalanceInputSchema = z.object({
  response_format: responseFormatSchema,
});

// ── Payin (PIX recebido) ────────────────────────────────────────────────────

export const PayinCreateInputSchema = z.object({
  amount_brl: z
    .number()
    .positive()
    .describe('Valor a receber em reais (ex: 100.50)'),
  payer_document: z
    .string()
    .min(11)
    .max(14)
    .describe('CPF (11 digitos) ou CNPJ (14 digitos) do pagador'),
  payer_name: z
    .string()
    .min(3)
    .max(100)
    .describe('Nome completo do pagador'),
  payer_person_type: z
    .number()
    .int()
    .min(0)
    .max(1)
    .default(0)
    .describe('Tipo de pessoa: 0 = PF, 1 = PJ'),
  description: z
    .string()
    .max(140)
    .optional()
    .describe('Descricao opcional'),
  user_id: z
    .string()
    .optional()
    .describe('ID do usuario Ashar associado'),
  response_format: responseFormatSchema,
});

export const PayinQueryInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe('Codigo externo da ordem payin a consultar'),
  response_format: responseFormatSchema,
});

// ── Payout (PIX enviado) ────────────────────────────────────────────────────

export const PayoutCreateInputSchema = z.object({
  pix_key_value: z
    .string()
    .min(1)
    .describe('Chave PIX de destino (CPF, CNPJ, email, telefone ou EVP)'),
  pix_key_type: z
    .string()
    .min(1)
    .describe('Tipo da chave PIX: CPF, CNPJ, EMAIL, PHONE, EVP'),
  amount_brl: z
    .number()
    .positive()
    .describe('Valor a enviar em reais (ex: 50.00)'),
  receiver_document: z
    .string()
    .min(11)
    .max(14)
    .describe('CPF ou CNPJ do recebedor'),
  receiver_name: z
    .string()
    .min(3)
    .max(100)
    .optional()
    .describe('Nome do recebedor'),
  description: z
    .string()
    .max(140)
    .optional()
    .describe('Descricao opcional do pagamento'),
  response_format: responseFormatSchema,
});

export const PayoutQueryInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe('Codigo externo da ordem payout a consultar'),
  response_format: responseFormatSchema,
});
