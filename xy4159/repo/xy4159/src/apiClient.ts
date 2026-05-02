import axios from 'axios';
import { ReviewCard, PullRequest, CreateCardRequest, UpdateCardRequest, Severity, CardStatus } from './types';

const API_BASE_URL = 'http://localhost:38765/api';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await axios.get(`${this.baseUrl}/health`);
    return response.data;
  }

  async getPRs(): Promise<PullRequest[]> {
    const response = await axios.get(`${this.baseUrl}/prs`);
    return response.data.map((pr: any) => this.mapPR(pr));
  }

  async getPR(id: string): Promise<PullRequest | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/prs/${id}`);
      return this.mapPR(response.data);
    } catch (error) {
      return null;
    }
  }

  async createPR(title: string, description?: string, sourceBranch?: string, targetBranch?: string): Promise<string> {
    const response = await axios.post(`${this.baseUrl}/prs`, {
      title,
      description,
      sourceBranch,
      targetBranch
    });
    return response.data.id;
  }

  async deletePR(id: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/prs/${id}`);
  }

  async importDiff(prTitle: string, diffContent: string, sourceBranch?: string, targetBranch?: string): Promise<{ prId: string; stats: any }> {
    const response = await axios.post(`${this.baseUrl}/prs/import-diff`, {
      prTitle,
      diffContent,
      sourceBranch,
      targetBranch
    });
    return response.data;
  }

  async getCards(prId: string): Promise<ReviewCard[]> {
    const response = await axios.get(`${this.baseUrl}/prs/${prId}/cards`);
    return response.data.map((card: any) => this.mapCard(card));
  }

  async getCard(id: string): Promise<ReviewCard | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/cards/${id}`);
      return this.mapCard(response.data);
    } catch (error) {
      return null;
    }
  }

  async createCard(request: CreateCardRequest): Promise<string> {
    const response = await axios.post(`${this.baseUrl}/cards`, request);
    return response.data.id;
  }

  async updateCard(id: string, updates: UpdateCardRequest): Promise<void> {
    await axios.patch(`${this.baseUrl}/cards/${id}`, updates);
  }

  async deleteCard(id: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/cards/${id}`);
  }

  async addLocation(cardId: string, location: {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
    lineContent?: string;
    contextBefore?: string[];
    contextAfter?: string[];
  }): Promise<string> {
    const response = await axios.post(`${this.baseUrl}/cards/${cardId}/locations`, location);
    return response.data.id;
  }

  async addAttachment(cardId: string, attachment: {
    type: 'screenshot' | 'log' | 'image';
    name: string;
    data: string;
    mimeType: string;
  }): Promise<string> {
    const response = await axios.post(`${this.baseUrl}/cards/${cardId}/attachments`, attachment);
    return response.data.id;
  }

  async exportMarkdown(prId: string, options: {
    includeAttachments?: boolean;
    includeReviewHistory?: boolean;
    status?: string;
    severity?: string;
  } = {}): Promise<string> {
    const params = new URLSearchParams();
    if (options.includeAttachments) params.append('includeAttachments', 'true');
    if (options.includeReviewHistory) params.append('includeReviewHistory', 'true');
    if (options.status) params.append('status', options.status);
    if (options.severity) params.append('severity', options.severity);

    const response = await axios.get(`${this.baseUrl}/prs/${prId}/export/markdown?${params.toString()}`, {
      responseType: 'text'
    });
    return response.data;
  }

  async exportJson(prId: string, options: {
    status?: string;
    severity?: string;
  } = {}): Promise<string> {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.severity) params.append('severity', options.severity);

    const response = await axios.get(`${this.baseUrl}/prs/${prId}/export/json?${params.toString()}`);
    return JSON.stringify(response.data, null, 2);
  }

  private mapPR(pr: any): PullRequest {
    return {
      id: pr.id,
      title: pr.title,
      description: pr.description,
      sourceBranch: pr.source_branch,
      targetBranch: pr.target_branch,
      author: pr.author,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at
    };
  }

  private mapCard(card: any): ReviewCard {
    return {
      id: card.id,
      prId: card.pr_id,
      title: card.title,
      description: card.description || '',
      severity: card.severity as Severity,
      status: card.status as CardStatus,
      codeLocations: card.codeLocations || [],
      attachments: card.attachments || [],
      reviewRecords: card.reviewRecords || [],
      createdAt: card.created_at,
      updatedAt: card.updated_at
    };
  }
}

export const apiClient = new ApiClient();
