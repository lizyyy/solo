import fetch from 'node-fetch';
import { storage } from '../storage';
import { signatureService } from '../signature';
import {
  WebhookTemplate,
  WebhookDelivery,
  SimulationStrategy,
  CreateSimulationInput,
  DeliveryResult,
} from '../types';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function getValueByPath(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return `default-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }
  
  return String(current);
}

interface DeliveryPlan {
  template: WebhookTemplate;
  delayMs: number;
  isDuplicate: boolean;
  hasInvalidSignature: boolean;
  shouldFail: boolean;
}

export class DispatcherService {
  private async sendWebhook(
    url: string,
    payload: Record<string, unknown>,
    signature: string,
    timestamp: number,
    eventType: string,
    idempotencyKey: string
  ): Promise<DeliveryResult> {
    const startTime = Date.now();
    const signatureHeader = signatureService.buildSignatureHeader(signature, timestamp);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signatureHeader,
          'X-Webhook-Event': eventType,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        timeout: 10000,
      });

      const durationMs = Date.now() - startTime;
      const isSuccess = response.status >= 200 && response.status < 300;

      return {
        success: isSuccess,
        statusCode: response.status,
        durationMs,
        errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        statusCode: null,
        durationMs,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private generateDeliveryPlan(
    templates: WebhookTemplate[],
    strategy: SimulationStrategy,
    options: {
      delayMs?: number;
      duplicateCount?: number;
      signatureInvalidCount?: number;
      failureCount?: number;
    } = {}
  ): DeliveryPlan[] {
    const plans: DeliveryPlan[] = templates.map(template => ({
      template,
      delayMs: 0,
      isDuplicate: false,
      hasInvalidSignature: false,
      shouldFail: false,
    }));

    switch (strategy) {
      case 'normal':
        plans.forEach((plan, index) => {
          plan.delayMs = index * (options.delayMs ?? 100);
        });
        break;

      case 'out_of_order': {
        const shuffled = [...plans];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        shuffled.forEach((plan, index) => {
          plan.delayMs = index * (options.delayMs ?? 100);
        });
        break;
      }

      case 'duplicate': {
        const duplicateCount = options.duplicateCount ?? 2;
        const originalPlans = [...plans];
        
        for (let i = 0; i < duplicateCount; i++) {
          for (const originalPlan of originalPlans) {
            plans.push({
              template: originalPlan.template,
              delayMs: (i + 1) * (options.delayMs ?? 500),
              isDuplicate: true,
              hasInvalidSignature: false,
              shouldFail: false,
            });
          }
        }
        break;
      }

      case 'delayed':
        plans.forEach((plan, index) => {
          plan.delayMs = (index + 1) * (options.delayMs ?? 1000);
        });
        break;

      case 'signature_error': {
        const invalidCount = options.signatureInvalidCount ?? 1;
        const shuffledIndexes = [...Array(plans.length).keys()];
        for (let i = shuffledIndexes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledIndexes[i], shuffledIndexes[j]] = [shuffledIndexes[j], shuffledIndexes[i]];
        }
        const selectedIndexes = shuffledIndexes.slice(0, Math.min(invalidCount, plans.length));
        selectedIndexes.forEach(index => {
          plans[index].hasInvalidSignature = true;
        });
        plans.forEach((plan, index) => {
          plan.delayMs = index * (options.delayMs ?? 100);
        });
        break;
      }

      case 'partial_failure': {
        const failCount = options.failureCount ?? Math.ceil(plans.length / 2);
        const shuffledIndexes = [...Array(plans.length).keys()];
        for (let i = shuffledIndexes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledIndexes[i], shuffledIndexes[j]] = [shuffledIndexes[j], shuffledIndexes[i]];
        }
        const selectedIndexes = shuffledIndexes.slice(0, Math.min(failCount, plans.length));
        selectedIndexes.forEach(index => {
          plans[index].shouldFail = true;
        });
        plans.forEach((plan, index) => {
          plan.delayMs = index * (options.delayMs ?? 100);
        });
        break;
      }
    }

    return plans.sort((a, b) => a.delayMs - b.delayMs);
  }

  async executeSimulation(input: CreateSimulationInput): Promise<void> {
    const simulation = storage.createSimulation(input);
    storage.updateSimulationStatus(simulation.id, 'running');

    const templates: WebhookTemplate[] = [];
    for (const templateId of input.templateIds) {
      const template = storage.getTemplate(templateId);
      if (template) {
        templates.push(template);
      }
    }

    if (templates.length === 0) {
      storage.updateSimulationStatus(simulation.id, 'failed');
      return;
    }

    const plans = this.generateDeliveryPlan(templates, input.strategy, {
      delayMs: input.delayMs,
      duplicateCount: input.duplicateCount,
      signatureInvalidCount: input.signatureInvalidCount,
      failureCount: input.failureCount,
    });

    for (const plan of plans) {
      await this.executeDelivery(simulation.id, plan, input.targetUrl);
    }

    storage.updateSimulationStatus(simulation.id, 'completed');
  }

  private async executeDelivery(
    simulationId: string,
    plan: DeliveryPlan,
    targetUrl: string
  ): Promise<WebhookDelivery> {
    const { template, delayMs, hasInvalidSignature, shouldFail } = plan;

    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const idempotencyKey = getValueByPath(template.payload, template.idempotencyKeyPath);

    const signatureResult = signatureService.generateSignature(template.payload, template.secret);
    const actualSignature = hasInvalidSignature 
      ? `invalid-${signatureResult.signature}` 
      : signatureResult.signature;

    const delivery = storage.createDelivery(
      simulationId,
      template.id,
      template.eventType,
      targetUrl,
      template.payload,
      idempotencyKey,
      actualSignature,
      signatureResult.digest,
      plan.isDuplicate ? 'duplicate' : 'normal',
      template.defaultRetryCount
    );

    storage.recordIdempotencyEntry(
      idempotencyKey,
      template.eventType,
      delivery.id,
      simulationId
    );

    const effectiveUrl = shouldFail 
      ? this.generateFailureUrl(targetUrl)
      : targetUrl;

    let result = await this.sendWebhook(
      effectiveUrl,
      template.payload,
      actualSignature,
      signatureResult.timestamp,
      template.eventType,
      idempotencyKey
    );

    let currentRetry = 0;
    while (!result.success && currentRetry < template.defaultRetryCount) {
      currentRetry++;
      const retryDelay = this.getExponentialBackoff(currentRetry);
      await sleep(retryDelay);

      result = await this.sendWebhook(
        effectiveUrl,
        template.payload,
        actualSignature,
        signatureResult.timestamp,
        template.eventType,
        idempotencyKey
      );
    }

    storage.updateDeliveryResult(
      delivery.id,
      result.statusCode,
      result.durationMs,
      result.errorMessage,
      currentRetry,
      result.success
    );

    const updatedDelivery = storage.getDelivery(delivery.id)!;

    if (!result.success) {
      storage.addToDeadLetterQueue(
        updatedDelivery,
        result.errorMessage || 'Delivery failed after retries'
      );
    }

    return updatedDelivery;
  }

  private generateFailureUrl(originalUrl: string): string {
    try {
      const url = new URL(originalUrl);
      url.pathname = `${url.pathname}/fail`.replace(/\/+/g, '/');
      return url.toString();
    } catch {
      return originalUrl;
    }
  }

  private getExponentialBackoff(retryCount: number): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay * Math.pow(2, retryCount - 1) + jitter, maxDelay);
  }

  async replayDeadLetterItem(itemId: string): Promise<WebhookDelivery | null> {
    const item = storage.getDeadLetterQueueItem(itemId);
    if (!item || item.isReplayed) {
      return null;
    }

    const signatureResult = signatureService.generateSignature(item.payload, 'replay-secret');
    
    const delivery = storage.createDelivery(
      item.simulationId,
      item.templateId,
      item.eventType,
      item.targetUrl,
      item.payload,
      item.idempotencyKey,
      signatureResult.signature,
      signatureResult.digest,
      'replay',
      3
    );

    storage.recordIdempotencyEntry(
      item.idempotencyKey,
      item.eventType,
      delivery.id,
      item.simulationId
    );

    const result = await this.sendWebhook(
      item.targetUrl,
      item.payload,
      signatureResult.signature,
      signatureResult.timestamp,
      item.eventType,
      item.idempotencyKey
    );

    storage.updateDeliveryResult(
      delivery.id,
      result.statusCode,
      result.durationMs,
      result.errorMessage,
      0,
      result.success
    );

    storage.markDeadLetterAsReplayed(itemId);

    return storage.getDelivery(delivery.id);
  }

  async replayAllPendingDeadLetters(): Promise<number> {
    const pendingItems = storage.getPendingDeadLetterItems();
    let replayedCount = 0;

    for (const item of pendingItems) {
      const result = await this.replayDeadLetterItem(item.id);
      if (result) {
        replayedCount++;
      }
    }

    return replayedCount;
  }
}

export const dispatcherService = new DispatcherService();
