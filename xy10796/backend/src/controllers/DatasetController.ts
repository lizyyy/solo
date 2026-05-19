import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { ReportService } from '../services/ReportService';

export class DatasetController {
  static async createDataset(req: Request, res: Response): Promise<void> {
    try {
      const { version, name, description, importOrder, schema, metadata } = req.body;

      if (!version || !name) {
        res.status(400).json({ error: 'Version and name are required' });
        return;
      }

      const newDataset = {
        id: uuidv4(),
        version,
        name,
        description,
        importOrder: importOrder || 0,
        schema,
        metadata,
        status: 'draft',
        recordCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.read();
      db.data.datasets.push(newDataset);
      await db.write();

      res.status(201).json({ message: 'Dataset created successfully', dataset: newDataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getDatasets(req: Request, res: Response): Promise<void> {
    try {
      const { status, name } = req.query;

      await db.read();
      let datasets = [...db.data.datasets];
      
      if (status) datasets = datasets.filter(d => d.status === status);
      if (name) datasets = datasets.filter(d => d.name === name);

      datasets = datasets.sort((a, b) => a.importOrder - b.importOrder);

      res.json({ datasets });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getDatasetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await db.read();
      const dataset = db.data.datasets.find(d => d.id === id);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      res.json({ dataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { version, name, description, status, importOrder, schema, metadata } = req.body;

      await db.read();
      const dataset = db.data.datasets.find(d => d.id === id);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      if (version !== undefined) dataset.version = version;
      if (name !== undefined) dataset.name = name;
      if (description !== undefined) dataset.description = description;
      if (status !== undefined) dataset.status = status;
      if (importOrder !== undefined) dataset.importOrder = importOrder;
      if (schema !== undefined) dataset.schema = schema;
      if (metadata !== undefined) dataset.metadata = metadata;
      dataset.updatedAt = new Date().toISOString();

      await db.write();
      await ReportService.recalculateDatasetStats(id);

      res.json({ message: 'Dataset updated successfully, stats recalculated', dataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async publishDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await db.read();
      const dataset = db.data.datasets.find(d => d.id === id);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      dataset.status = 'published';
      dataset.updatedAt = new Date().toISOString();
      await db.write();

      res.json({ message: 'Dataset published successfully', dataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await db.read();
      const index = db.data.datasets.findIndex(d => d.id === id);
      if (index === -1) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      db.data.datasets.splice(index, 1);
      await db.write();

      res.json({ message: 'Dataset deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
