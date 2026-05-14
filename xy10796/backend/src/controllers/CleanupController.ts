import { Request, Response } from 'express';
import { CleanupStrategy, Environment } from '../models';
import { StrategyStatus } from '../models/CleanupStrategy';
import { logger } from '../config/logger';

export class CleanupController {
  static async createStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, environmentId, cleanupType, retentionDays, correctionPath } = req.body;

      if (!name || !environmentId || !cleanupType) {
        res.status(400).json({ error: 'name, environmentId and cleanupType are required' });
        return;
      }

      const environment = await Environment.findByPk(environmentId);
      if (!environment) {
        res.status(404).json({ error: 'Environment not found' });
        return;
      }

      const strategy = await CleanupStrategy.create({
        name,
        description,
        environmentId,
        cleanupType,
        retentionDays: retentionDays || 30,
        correctionPath,
        status: StrategyStatus.ACTIVE,
      });

      res.status(201).json({ message: 'Strategy created successfully', strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getStrategies(req: Request, res: Response): Promise<void> {
    try {
      const { status, environmentId } = req.query;
      const where: any = {};
      if (status) where.status = status;
      if (environmentId) where.environmentId = environmentId;

      const strategies = await CleanupStrategy.findAll({
        where,
        include: [Environment],
        order: [['createdAt', 'DESC']],
      });

      res.json({ strategies });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getStrategyById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const strategy = await CleanupStrategy.findByPk(id, {
        include: [Environment],
      });

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      res.json({ strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async executeStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const strategy = await CleanupStrategy.findByPk(id);

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      await strategy.update({
        status: StrategyStatus.ACTIVE,
        lastExecutedAt: new Date(),
      });

      logger.info(`Cleanup strategy ${id} executed`);
      res.json({ message: 'Strategy executed successfully', strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateCorrectionPath(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { correctionPath } = req.body;

      if (!correctionPath) {
        res.status(400).json({ error: 'correctionPath is required' });
        return;
      }

      const strategy = await CleanupStrategy.findByPk(id);
      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      await strategy.update({ correctionPath });
      res.json({ message: 'Correction path updated successfully', strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async markStrategyFailed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { errorMessage } = req.body;

      const strategy = await CleanupStrategy.findByPk(id);
      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      await strategy.update({
        status: StrategyStatus.FAILED,
        errorMessage,
      });

      res.json({ message: 'Strategy marked as failed', strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const strategy = await CleanupStrategy.findByPk(id);

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      await strategy.destroy();
      res.json({ message: 'Strategy deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
