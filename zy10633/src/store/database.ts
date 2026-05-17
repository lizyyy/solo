import { v4 as uuidv4 } from 'uuid';
import { Article, ArticleVersion, RollbackRecord, ArticleStatus, RollbackStatus, RollbackFilter, PaginationParams, PaginatedResult } from '../types';

export class Database {
  private articles: Map<string, Article> = new Map();
  private versions: Map<string, ArticleVersion> = new Map();
  private rollbackRecords: Map<string, RollbackRecord> = new Map();

  createArticle(data: Omit<Article, 'id' | 'currentVersion' | 'createdAt' | 'updatedAt'>): Article {
    const now = new Date();
    const article: Article = {
      ...data,
      id: uuidv4(),
      currentVersion: 1,
      createdAt: now,
      updatedAt: now
    };
    this.articles.set(article.id, article);
    return article;
  }

  getArticle(id: string): Article | undefined {
    return this.articles.get(id);
  }

  updateArticle(id: string, data: Partial<Article>): Article | undefined {
    const article = this.articles.get(id);
    if (!article) return undefined;
    
    const updated = { ...article, ...data, updatedAt: new Date() };
    this.articles.set(id, updated);
    return updated;
  }

  createVersion(data: Omit<ArticleVersion, 'id' | 'createdAt'>): ArticleVersion {
    const version: ArticleVersion = {
      ...data,
      id: uuidv4(),
      createdAt: new Date()
    };
    this.versions.set(version.id, version);
    return version;
  }

  getVersionsByArticleId(articleId: string): ArticleVersion[] {
    return Array.from(this.versions.values())
      .filter(v => v.articleId === articleId)
      .sort((a, b) => b.version - a.version);
  }

  getVersion(articleId: string, version: number): ArticleVersion | undefined {
    return Array.from(this.versions.values())
      .find(v => v.articleId === articleId && v.version === version);
  }

  createRollbackRecord(data: Omit<RollbackRecord, 'id' | 'requestedAt'>): RollbackRecord {
    const record: RollbackRecord = {
      ...data,
      id: uuidv4(),
      requestedAt: new Date()
    };
    this.rollbackRecords.set(record.id, record);
    return record;
  }

  updateRollbackRecord(id: string, data: Partial<RollbackRecord>): RollbackRecord | undefined {
    const record = this.rollbackRecords.get(id);
    if (!record) return undefined;
    
    const updated = { ...record, ...data };
    this.rollbackRecords.set(id, updated);
    return updated;
  }

  getRollbackRecord(id: string): RollbackRecord | undefined {
    return this.rollbackRecords.get(id);
  }

  getRollbackRecords(filter: RollbackFilter, pagination: PaginationParams): PaginatedResult<RollbackRecord> {
    let records = Array.from(this.rollbackRecords.values());

    if (filter.startDate) {
      records = records.filter(r => r.requestedAt >= filter.startDate!);
    }
    if (filter.endDate) {
      records = records.filter(r => r.requestedAt <= filter.endDate!);
    }
    if (filter.status) {
      records = records.filter(r => r.status === filter.status);
    }
    if (filter.requestedBy) {
      records = records.filter(r => r.requestedBy === filter.requestedBy);
    }
    if (filter.businessObject) {
      records = records.filter(r => r.businessObject === filter.businessObject);
    }
    if (filter.articleId) {
      records = records.filter(r => r.articleId === filter.articleId);
    }

    records.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

    const total = records.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    const paginatedData = records.slice(start, end);

    return {
      data: paginatedData,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize)
    };
  }

  getRollbackHistory(articleId: string): RollbackRecord[] {
    return Array.from(this.rollbackRecords.values())
      .filter(r => r.articleId === articleId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  getAllArticles(): Article[] {
    return Array.from(this.articles.values());
  }

  getAllRollbackRecords(): RollbackRecord[] {
    return Array.from(this.rollbackRecords.values())
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }
}

export const db = new Database();
