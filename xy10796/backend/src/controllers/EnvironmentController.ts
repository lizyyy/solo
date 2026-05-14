import { Request, Response } from 'express';
import { Environment } from '../models';
import { EnvironmentStatus } from '../models/Environment';

export class EnvironmentController {
  static async createEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, baseUrl, metadata } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const environment = await Environment.create({
        name,
        description,
        baseUrl,
        metadata,
        status: EnvironmentStatus.ACTIVE,
      });

      res.status(201).json({ message: 'Environment created successfully', environment });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getEnvironments(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const where: any = {};
      if (status) where.status = status;

      const environments = await Environment.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });

      res.json({ environments });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getEnvironmentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const environment = await Environment.findByPk(id);

      if (!environment) {
        res.status(404).json({ error: 'Environment not found' });
        return;
      }

      res.json({ environment });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, status, baseUrl, metadata } = req.body;

      const environment = await Environment.findByPk(id);
      if (!environment) {
        res.status(404).json({ error: 'Environment not found' });
        return;
      }

      await environment.update({ name, description, status, baseUrl, metadata });
      res.json({ message: 'Environment updated successfully', environment });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const environment = await Environment.findByPk(id);

      if (!environment) {
        res.status(404).json({ error: 'Environment not found' });
        return;
      }

      await environment.destroy();
      res.json({ message: 'Environment deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
