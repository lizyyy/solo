import { db } from '../store/database';
import { Article, ArticleStatus, ArticleVersion, RollbackStatus } from '../types';

export class ArticleService {
  createArticle(title: string, content: string, businessObject: string, createdBy: string): Article {
    const article = db.createArticle({
      title,
      content,
      status: ArticleStatus.DRAFT,
      businessObject,
      createdBy
    });

    db.createVersion({
      articleId: article.id,
      version: 1,
      title,
      content,
      createdBy,
      isPublished: false
    });

    return article;
  }

  updateArticle(articleId: string, title: string, content: string, updatedBy: string): Article | null {
    const article = db.getArticle(articleId);
    if (!article) return null;

    const newVersion = article.currentVersion + 1;

    db.createVersion({
      articleId,
      version: newVersion,
      title,
      content,
      createdBy: updatedBy,
      isPublished: false
    });

    return db.updateArticle(articleId, {
      title,
      content,
      currentVersion: newVersion
    }) || null;
  }

  publishArticle(articleId: string, publishedBy: string): Article | null {
    const article = db.getArticle(articleId);
    if (!article) return null;

    const currentVersion = db.getVersion(articleId, article.currentVersion);
    if (!currentVersion) return null;

    const now = new Date();
    
    db.createVersion({
      articleId,
      version: article.currentVersion,
      title: article.title,
      content: article.content,
      createdBy: publishedBy,
      isPublished: true,
      publishedAt: now
    });

    return db.updateArticle(articleId, {
      status: ArticleStatus.PUBLISHED,
      publishedAt: now,
      publishedBy
    }) || null;
  }

  requestRollback(articleId: string, targetVersion: number, requestedBy: string, reason: string) {
    const article = db.getArticle(articleId);
    if (!article) {
      return { success: false, error: '文章不存在' };
    }

    if (article.status !== ArticleStatus.PUBLISHED) {
      return { success: false, error: '只有已发布的文章才能回滚' };
    }

    const targetVersionData = db.getVersion(articleId, targetVersion);
    if (!targetVersionData) {
      return { success: false, error: '目标版本不存在' };
    }

    if (targetVersion >= article.currentVersion) {
      return { success: false, error: '只能回滚到历史版本' };
    }

    db.updateArticle(articleId, { status: ArticleStatus.ROLLING_BACK });

    const rollbackRecord = db.createRollbackRecord({
      articleId,
      articleTitle: article.title,
      fromVersion: article.currentVersion,
      toVersion: targetVersion,
      requestedBy,
      reason,
      status: RollbackStatus.SUCCESS,
      businessObject: article.businessObject,
      executedAt: new Date(),
      executedBy: requestedBy
    });

    db.updateArticle(articleId, {
      title: targetVersionData.title,
      content: targetVersionData.content,
      currentVersion: article.currentVersion + 1,
      status: ArticleStatus.RESTORED
    });

    db.createVersion({
      articleId,
      version: article.currentVersion + 1,
      title: targetVersionData.title,
      content: targetVersionData.content,
      createdBy: requestedBy,
      isPublished: true,
      publishedAt: new Date()
    });

    return { success: true, data: rollbackRecord };
  }

  getArticle(articleId: string): Article | undefined {
    return db.getArticle(articleId);
  }

  getArticleVersions(articleId: string): ArticleVersion[] {
    return db.getVersionsByArticleId(articleId);
  }
}

export const articleService = new ArticleService();
