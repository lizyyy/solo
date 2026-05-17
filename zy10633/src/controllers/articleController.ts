import { Request, Response } from 'express';
import { articleService } from '../services/articleService';

export class ArticleController {
  async createArticle(req: Request, res: Response) {
    try {
      const { title, content, businessObject, createdBy } = req.body;

      if (!title || !content || !businessObject || !createdBy) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必填参数: title, content, businessObject, createdBy' 
        });
      }

      const article = articleService.createArticle(title, content, businessObject, createdBy);
      res.json({ success: true, data: article });
    } catch (error) {
      res.status(500).json({ success: false, error: '创建失败' });
    }
  }

  async updateArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, content, updatedBy } = req.body;

      if (!title || !content || !updatedBy) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必填参数: title, content, updatedBy' 
        });
      }

      const result = articleService.updateArticle(id, title, content, updatedBy);
      
      if (!result) {
        return res.status(404).json({ success: false, error: '文章不存在' });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: '更新失败' });
    }
  }

  async publishArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { publishedBy } = req.body;

      if (!publishedBy) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必填参数: publishedBy' 
        });
      }

      const result = articleService.publishArticle(id, publishedBy);
      
      if (!result) {
        return res.status(404).json({ success: false, error: '文章不存在' });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: '发布失败' });
    }
  }

  async getArticle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const article = articleService.getArticle(id);
      
      if (!article) {
        return res.status(404).json({ success: false, error: '文章不存在' });
      }

      res.json({ success: true, data: article });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询失败' });
    }
  }

  async getArticleVersions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const versions = articleService.getArticleVersions(id);
      res.json({ success: true, data: versions });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询失败' });
    }
  }
}

export const articleController = new ArticleController();
