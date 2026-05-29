import { Request, Response } from 'express';
import { ArrangementService } from '../services/ArrangementService';
import { Arrangement } from '../../shared/types';

export class ArrangementController {
  private arrangementService: ArrangementService;

  constructor() {
    this.arrangementService = new ArrangementService();
  }

  getAll = (_req: Request, res: Response) => {
    try {
      const arrangements = this.arrangementService.getAllArrangements();
      res.json(arrangements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getById = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const arrangement = this.arrangementService.getArrangementById(id);
      if (!arrangement) {
        res.status(404).json({ error: '排布不存在' });
        return;
      }
      res.json(arrangement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getLatest = (_req: Request, res: Response) => {
    try {
      const arrangement = this.arrangementService.getLatestArrangement();
      if (!arrangement) {
        res.status(404).json({ error: '暂无排布记录' });
        return;
      }
      res.json(arrangement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  create = (req: Request, res: Response) => {
    try {
      const data = req.body as Omit<Arrangement, 'id' | 'createdAt'>;
      const arrangement = this.arrangementService.createArrangement(data);
      res.status(201).json(arrangement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  update = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const arrangement = this.arrangementService.updateArrangement(id, data);
      if (!arrangement) {
        res.status(404).json({ error: '排布不存在' });
        return;
      }
      res.json(arrangement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  assign = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { stallId, vendorId, source } = req.body;
      if (!stallId || !vendorId) {
        res.status(400).json({ error: '摊位ID和摊主ID不能为空' });
        return;
      }
      const assignment = this.arrangementService.assignVendorToStall(
        id,
        stallId,
        vendorId,
        source || '手动分配'
      );
      res.json(assignment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  removeAssignment = (req: Request, res: Response) => {
    try {
      const { id, stallId } = req.params;
      const success = this.arrangementService.removeAssignment(id, stallId);
      if (!success) {
        res.status(404).json({ error: '分配不存在' });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  swap = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { stallA, stallB, reason, operator } = req.body;
      if (!stallA || !stallB) {
        res.status(400).json({ error: '两个摊位ID不能为空' });
        return;
      }
      const result = this.arrangementService.swapVendors(
        id,
        stallA,
        stallB,
        reason || '',
        operator || '系统管理员'
      );
      if (!result.success) {
        res.status(400).json({ error: result.message });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  detectConflicts = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const conflicts = this.arrangementService.detectConflicts(id);
      res.json(conflicts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getSwapLogs = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const logs = this.arrangementService.getSwapLogs(id);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getAssignments = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const assignments = this.arrangementService.getAssignmentsWithDetails(id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  createVersion = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newVersion, name, createdBy, note } = req.body;
      if (!newVersion || !name || !createdBy) {
        res.status(400).json({ error: '版本号、名称、创建人不能为空' });
        return;
      }
      const newArrangement = this.arrangementService.createNewVersion(
        id,
        newVersion,
        name,
        createdBy,
        note
      );
      if (!newArrangement) {
        res.status(404).json({ error: '源排布不存在' });
        return;
      }
      res.status(201).json(newArrangement);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
