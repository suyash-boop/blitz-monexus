export {
  // Protocol
  withX402Payment,
  createPaymentRequiredResponse,
  verifyPaymentFromRequest,
  settlePayment,
  matchRoute,
  encodePaymentRequired,
  decodePaymentRequired,
  encodePaymentPayload,
  decodePaymentPayload,
  encodeSettlementResponse,
} from './protocol';

export type {
  PaymentRequirements,
  PaymentPayload,
  SettlementResponse,
  RoutePaymentConfig,
  RoutesConfig,
} from './protocol';

// Client
export { X402Client, createX402Client } from './client';
export type { X402ClientConfig, X402FetchOptions, X402Response } from './client';
