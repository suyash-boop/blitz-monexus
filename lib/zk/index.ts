export {
  createPaymentCommitment,
  generatePaymentProof,
  verifyPaymentProof,
  createPaymentReceipt,
  isNullifierUsed,
  markNullifierUsed,
  clearNullifiers,
} from './proof';

export type {
  ZKPaymentProof,
  ZKVerificationResult,
  PaymentCommitment,
} from './proof';
