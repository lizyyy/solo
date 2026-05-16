import { v4 as uuidv4 } from 'uuid';
import {
  CacheExplanation,
  CacheExplanationStatus,
  CreateExplanationRequest,
  QueryExplanationParams,
  ManualCorrectionRequest,
  ForceRefreshRequest
} from '../types';

class CacheExplanationStore {
  private explanations: Map<string, CacheExplanation> = new Map();

  create(request: CreateExplanationRequest): CacheExplanation {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.ttlSeconds * 1000);

    const explanation: CacheExplanation = {
      id: uuidv4(),
      apiPath: request.apiPath,
      cacheKey: request.cacheKey,
      cacheKeyCalculation: request.cacheKeyCalculation,
      matchedRule: {
        ...request.matchedRule,
        createdAt: now
      },
      generatedAt: now,
      expiration: {
        expiresAt,
        ttlSeconds: request.ttlSeconds,
        conditions: request.expirationConditions
      },
      status: CacheExplanationStatus.PENDING,
      explanationReport: request.explanationReport,
      hitHistory: [],
      metadata: {
        createdBy: request.createdBy,
        createdAt: now,
        updatedAt: now
      }
    };

    this.explanations.set(explanation.id, explanation);
    return explanation;
  }

  findById(id: string): CacheExplanation | undefined {
    return this.explanations.get(id);
  }

  findByCacheKey(cacheKey: string): CacheExplanation | undefined {
    for (const exp of this.explanations.values()) {
      if (exp.cacheKey === cacheKey) {
        return exp;
      }
    }
    return undefined;
  }

  query(params: QueryExplanationParams): { data: CacheExplanation[]; total: number } {
    let results = Array.from(this.explanations.values());

    if (params.apiPath) {
      results = results.filter(e => e.apiPath.includes(params.apiPath!));
    }

    if (params.cacheKey) {
      results = results.filter(e => e.cacheKey === params.cacheKey);
    }

    if (params.status) {
      results = results.filter(e => e.status === params.status);
    }

    if (params.ruleId) {
      results = results.filter(e => e.matchedRule.id === params.ruleId);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: results.slice(start, end),
      total: results.length
    };
  }

  updateStatus(id: string, status: CacheExplanationStatus, updatedBy?: string): CacheExplanation | undefined {
    const explanation = this.explanations.get(id);
    if (!explanation) return undefined;

    explanation.status = status;
    explanation.metadata.updatedAt = new Date();

    if (status === CacheExplanationStatus.CONFIRMED && updatedBy) {
      explanation.metadata.confirmedBy = updatedBy;
      explanation.metadata.confirmedAt = new Date();
    }

    return explanation;
  }

  manualCorrection(request: ManualCorrectionRequest): CacheExplanation | undefined {
    const explanation = this.explanations.get(request.explanationId);
    if (!explanation) return undefined;

    explanation.status = request.newStatus;
    explanation.metadata.updatedAt = new Date();

    if (request.overrideTtl !== undefined) {
      explanation.expiration.ttlSeconds = request.overrideTtl;
      explanation.expiration.expiresAt = new Date(Date.now() + request.overrideTtl * 1000);
    }

    explanation.explanationReport.details.push(
      `人工修正: ${request.reason} (操作人: ${request.correctedBy})`
    );

    return explanation;
  }

  recordHit(cacheKey: string, requestId: string, clientIp?: string): CacheExplanation | undefined {
    const explanation = this.findByCacheKey(cacheKey);
    if (!explanation) return undefined;

    explanation.hitHistory.push({
      hitAt: new Date(),
      requestId,
      clientIp
    });

    return explanation;
  }

  forceRefresh(request: ForceRefreshRequest): CacheExplanation | undefined {
    const explanation = this.findByCacheKey(request.cacheKey);
    if (!explanation) return undefined;

    explanation.expiration.expiresAt = new Date();
    explanation.status = CacheExplanationStatus.REVOKED;
    explanation.metadata.updatedAt = new Date();

    explanation.explanationReport.details.push(
      `强制刷新: ${request.reason} (操作人: ${request.refreshedBy})`
    );

    return explanation;
  }

  recordFailure(
    id: string,
    rawInput: Record<string, unknown>,
    processingBasis: string[],
    finalConclusion: string,
    errorStack?: string
  ): CacheExplanation | undefined {
    const explanation = this.explanations.get(id);
    if (!explanation) return undefined;

    explanation.status = CacheExplanationStatus.BLOCKED;
    explanation.failureDetails = {
      rawInput,
      processingBasis,
      finalConclusion,
      errorStack
    };
    explanation.metadata.updatedAt = new Date();

    return explanation;
  }

  getAllForExport(): CacheExplanation[] {
    return Array.from(this.explanations.values());
  }
}

export const cacheExplanationStore = new CacheExplanationStore();
