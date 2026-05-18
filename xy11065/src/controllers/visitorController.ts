import { Request, Response } from 'express';
import { visitorService } from '../services/VisitorService';
import { AccessType } from '../types';

export const visitorController = {
  createVisitor: (req: Request, res: Response) => {
    try {
      const { createdBy, ...data } = req.body;
      if (!createdBy) {
        return res.status(400).json({ error: 'createdBy is required' });
      }
      const visitor = visitorService.createVisitor(data, createdBy);
      res.status(201).json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create visitor' });
    }
  },

  getAllVisitors: (_req: Request, res: Response) => {
    try {
      const visitors = visitorService.getAllVisitors();
      res.json(visitors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get visitors' });
    }
  },

  getVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const visitor = visitorService.getVisitor(id);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get visitor' });
    }
  },

  getVisitorHistory: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const visitor = visitorService.getVisitor(id);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      const history = visitorService.getVisitorHistory(id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get visitor history' });
    }
  },

  getVisitorAccessControls: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const visitor = visitorService.getVisitor(id);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      const accessControls = visitorService.getVisitorAccessControls(id);
      res.json(accessControls);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get access controls' });
    }
  },

  submitVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole } = req.body;
      if (!operator || !operatorRole) {
        return res.status(400).json({ error: 'operator and operatorRole are required' });
      }
      const visitor = visitorService.submitVisitor(id, operator, operatorRole);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit visitor' });
    }
  },

  approveVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole, comment } = req.body;
      if (!operator || !operatorRole) {
        return res.status(400).json({ error: 'operator and operatorRole are required' });
      }
      const visitor = visitorService.approveVisitor(id, operator, operatorRole, comment);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to approve visitor' });
    }
  },

  rejectVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole, reason } = req.body;
      if (!operator || !operatorRole || !reason) {
        return res.status(400).json({ error: 'operator, operatorRole and reason are required' });
      }
      const visitor = visitorService.rejectVisitor(id, operator, operatorRole, reason);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to reject visitor' });
    }
  },

  withdrawVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole, reason } = req.body;
      if (!operator || !operatorRole) {
        return res.status(400).json({ error: 'operator and operatorRole are required' });
      }
      const visitor = visitorService.withdrawVisitor(id, operator, operatorRole, reason);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to withdraw visitor' });
    }
  },

  resubmitVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole, updates } = req.body;
      if (!operator || !operatorRole) {
        return res.status(400).json({ error: 'operator and operatorRole are required' });
      }
      const visitor = visitorService.resubmitVisitor(id, operator, operatorRole, updates);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to resubmit visitor' });
    }
  },

  modifyVisitor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole, updates, comment } = req.body;
      if (!operator || !operatorRole || !updates) {
        return res.status(400).json({ error: 'operator, operatorRole and updates are required' });
      }
      const visitor = visitorService.modifyVisitor(id, operator, operatorRole, updates, comment);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to modify visitor' });
    }
  },

  changeVisitorFloor: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newFloor, operator, operatorRole, reason, keepOldAccess } = req.body;
      if (!newFloor || !operator || !operatorRole || !reason) {
        return res.status(400).json({ error: 'newFloor, operator, operatorRole and reason are required' });
      }
      const visitor = visitorService.changeVisitorFloor(id, newFloor, operator, operatorRole, reason, keepOldAccess);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to change visitor floor' });
    }
  },

  addComment: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator, operatorRole, comment } = req.body;
      if (!operator || !operatorRole || !comment) {
        return res.status(400).json({ error: 'operator, operatorRole and comment are required' });
      }
      const visitor = visitorService.addComment(id, operator, operatorRole, comment);
      if (!visitor) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(visitor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  },

  exportVisitorData: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = visitorService.exportVisitorData(id);
      if (!data) {
        return res.status(404).json({ error: 'Visitor not found' });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to export visitor data' });
    }
  }
};
