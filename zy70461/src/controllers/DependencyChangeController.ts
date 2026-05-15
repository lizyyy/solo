import { Request, Response } from 'express';
import { DependencyChangeDAO } from '../models/DependencyChangeDAO';

export class DependencyChangeController {
  static createChange(req: Request, res: Response) {
    try {
      const { dependencyName, oldVersion, newVersion, changeReason, requester } = req.body;

      const change = DependencyChangeDAO.create({
        dependencyName,
        oldVersion,
        newVersion,
        changeReason,
        requester,
        status: 'pending'
      });

      res.status(201).json({ success: true, data: change });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getChange(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const change = DependencyChangeDAO.getById(id);
      
      if (!change) {
        return res.status(404).json({ success: false, error: '变更记录不存在' });
      }

      res.json({ success: true, data: change });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static getAllChanges(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const changes = DependencyChangeDAO.getAll(status as string);
      res.json({ success: true, data: changes });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static approveChange(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const approver = req.headers['x-user'] as string || 'system';

      const change = DependencyChangeDAO.approve(id, approver);
      
      if (!change) {
        return res.status(404).json({ success: false, error: '变更记录不存在' });
      }

      res.json({ success: true, data: change });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static rejectChange(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const approver = req.headers['x-user'] as string || 'system';

      const change = DependencyChangeDAO.reject(id, approver);
      
      if (!change) {
        return res.status(404).json({ success: false, error: '变更记录不存在' });
      }

      res.json({ success: true, data: change });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
