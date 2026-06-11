import type { Request, Response } from 'express';
import { collisionService } from '../services/CollisionService.js';

export class AuditController {
  static list(req: Request, res: Response) {
    const query = req.query;
    const parsed: any = {};
    if (query.collisionId) parsed.collisionId = String(query.collisionId);
    if (query.operator) parsed.operator = String(query.operator);
    if (query.actionType) parsed.actionType = String(query.actionType);
    if (query.from) parsed.from = String(query.from);
    if (query.to) parsed.to = String(query.to);
    res.json(collisionService.getAudit(parsed));
  }
}

export class ExportController {
  static preview(_req: Request, res: Response) {
    res.json(collisionService.exportPreview());
  }
  static csv(_req: Request, res: Response) {
    const { filename, content } = collisionService.exportCSV();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(content);
  }
}

export class UserController {
  static me(_req: Request, res: Response) {
    // demo 登录态：默认当前用户为算法值班人 EN002 张工
    res.json({
      id: 'EN002',
      name: '张工',
      role: 'engineer',
    });
  }
}
