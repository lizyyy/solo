export interface WebhookTemplate {
  id: string;
  name: string;
  eventType: string;
  payload: Record<string, unknown>;
  secret: string;
  defaultRetryCount: number;
  defaultDelayMs: number;
  idempotencyKeyPath: string;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookDelivery {
  id: string;
  simulationId: string;
  templateId: string;
  eventType: string;
  targetUrl: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  signature: string;
  requestBodyDigest: string;
  statusCode: number | null;
  durationMs: number;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  isSuccess: boolean;
  isFirstAttempt: boolean;
  strategy: string;
  deliveredAt: number;
  createdAt: number;
}

export interface WebhookSimulation {
  id: string;
  name: string;
  strategy: SimulationStrategy;
  templateIds: string[];
  targetUrl: string;
  status: SimulationStatus;
  createdAt: number;
  completedAt: number | null;
}

export interface DeadLetterQueueItem {
  id: string;
  deliveryId: string;
  simulationId: string;
  templateId: string;
  eventType: string;
  targetUrl: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  signature: string;
  errorMessage: string;
  lastAttemptAt: number;
  retryCount: number;
  isReplayed: boolean;
  replayedAt: number | null;
  createdAt: number;
}

export interface IdempotencyLedgerEntry {
  id: string;
  idempotencyKey: string;
  eventType: string;
  firstDeliveryId: string;
  firstSimulationId: string;
  firstDeliveredAt: number;
  totalDeliveries: number;
  lastDeliveryId: string | null;
  createdAt: number;
}

export type SimulationStrategy = 
  | 'normal'
  | 'out_of_order'
  | 'duplicate'
  | 'delayed'
  | 'signature_error'
  | 'partial_failure';

export type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CreateTemplateInput {
  name: string;
  eventType: string;
  payload: Record<string, unknown>;
  secret: string;
  defaultRetryCount?: number;
  defaultDelayMs?: number;
  idempotencyKeyPath: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {}

export interface CreateSimulationInput {
  name: string;
  strategy: SimulationStrategy;
  templateIds: string[];
  targetUrl: string;
  delayMs?: number;
  duplicateCount?: number;
  signatureInvalidCount?: number;
  failureCount?: number;
}

export interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  durationMs: number;
  errorMessage: string | null;
}
