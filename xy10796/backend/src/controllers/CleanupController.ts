import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

export class CleanupController {
  static async createStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, environmentId, cleanupType, retentionDays, correctionPath } = req.body;

      if (!name || !environmentId || !cleanupType) {
        res.status(400).json({ error: 'name, environmentId and cleanupType are required' });
        return;
      }

      const newStrategy = {
        id: uuidv4(),
        name,
        description,
        environmentId,
        cleanupType,
        retentionDays: retentionDays || 30,
        correctionPath,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.read();
      db.data.cleanupStrategies.push(newStrategy);
      await db.write();

      res.status(201).json({ message: 'Strategy created successfully', strategy: newStrategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getStrategies(req: Request, res: Response): Promise<void> {
    try {
      const { status, environmentId } = req.query;

      await db.read();
      let strategies = [...db.data.cleanupStrategies];
      
      if (status) strategies = strategies.filter(s => s.status === status);
      if (environmentId) strategies = strategies.filter(s => s.environmentId === environmentId);

      strategies = strategies.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const strategiesWithEnv = strategies.map(strategy => ({
        ...strategy,
        Environment: db.data.environments.find(e => e.id === strategy.environmentId),
      }));

      res.json({ strategies: strategiesWithEnv });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getStrategyById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await db.read();
      const strategy = db.data.cleanupStrategies.find(s => s.id === id);

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      const environment = db.data.environments.find(e => e.id === strategy.environmentId);
      res.json({ strategy: { ...strategy, Environment: environment } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async executeStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await db.read();
      const strategy = db.data.cleanupStrategies.find(s => s.id === id);
      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      strategy.lastExecutedAt = new Date().toISOString();
      strategy.updatedAt = new Date().toISOString();
      await db.write();

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

      await db.read();
      const strategy = db.data.cleanupStrategies.find(s => s.id === id);
      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      strategy.correctionPath = correctionPath;
      strategy.updatedAt = new Date().toISOString();
      await db.write();

      res.json({ message: 'Correction path updated successfully', strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async markStrategyFailed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { errorMessage } = req.body;

      await db.read();
      const strategy = db.data.cleanupStrategies.find(s => s.id === id);
      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      strategy.status = 'failed';
      strategy.errorMessage = errorMessage;
      strategy.updatedAt = new Date().toISOString();
      await db.write();

      res.json({ message: 'Strategy marked as failed', strategy });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await db.read();
      const index = db.data.cleanupStrategies.findIndex(s => s.id === id);
      if (index === -1) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      db.data.cleanupStrategies.splice(index, 1);
      await db.write();

      res.json({ message: 'Strategy deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
