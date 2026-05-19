import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

export class EnvironmentController {
  static async createEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, baseUrl, metadata } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const newEnvironment = {
        id: uuidv4(),
        name,
        description,
        baseUrl,
        metadata,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.read();
      db.data.environments.push(newEnvironment);
      await db.write();

      res.status(201).json({ message: 'Environment created successfully', environment: newEnvironment });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getEnvironments(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;

      await db.read();
      let environments = [...db.data.environments];
      
      if (status) {
        environments = environments.filter(e => e.status === status);
      }

      environments = environments.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({ environments });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getEnvironmentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await db.read();
      const environment = db.data.environments.find(e => e.id === id);

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

      await db.read();
      const environment = db.data.environments.find(e => e.id === id);
      if (!environment) {
        res.status(404).json({ error: 'Environment not found' });
        return;
      }

      if (name !== undefined) environment.name = name;
      if (description !== undefined) environment.description = description;
      if (status !== undefined) environment.status = status;
      if (baseUrl !== undefined) environment.baseUrl = baseUrl;
      if (metadata !== undefined) environment.metadata = metadata;
      environment.updatedAt = new Date().toISOString();

      await db.write();
      res.json({ message: 'Environment updated successfully', environment });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await db.read();
      const index = db.data.environments.findIndex(e => e.id === id);
      if (index === -1) {
        res.status(404).json({ error: 'Environment not found' });
        return;
      }

      db.data.environments.splice(index, 1);
      await db.write();

      res.json({ message: 'Environment deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
