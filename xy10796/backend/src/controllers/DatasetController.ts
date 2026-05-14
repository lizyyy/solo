import { Request, Response } from 'express';
import { DatasetVersion } from '../models';
import { DatasetStatus } from '../models/DatasetVersion';
import { ReportService } from '../services/ReportService';

export class DatasetController {
  static async createDataset(req: Request, res: Response): Promise<void> {
    try {
      const { version, name, description, importOrder, schema, metadata } = req.body;

      if (!version || !name) {
        res.status(400).json({ error: 'Version and name are required' });
        return;
      }

      const dataset = await DatasetVersion.create({
        version,
        name,
        description,
        importOrder: importOrder || 0,
        schema,
        metadata,
        status: DatasetStatus.DRAFT,
      });

      res.status(201).json({ message: 'Dataset created successfully', dataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getDatasets(req: Request, res: Response): Promise<void> {
    try {
      const { status, name } = req.query;
      const where: any = {};
      if (status) where.status = status;
      if (name) where.name = name;

      const datasets = await DatasetVersion.findAll({
        where,
        order: [['importOrder', 'ASC'], ['createdAt', 'DESC']],
      });

      res.json({ datasets });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getDatasetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dataset = await DatasetVersion.findByPk(id);

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

      const dataset = await DatasetVersion.findByPk(id);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      await dataset.update({ version, name, description, status, importOrder, schema, metadata });

      await ReportService.recalculateDatasetStats(id);

      res.json({ message: 'Dataset updated successfully, stats recalculated', dataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async publishDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dataset = await DatasetVersion.findByPk(id);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      await dataset.update({ status: DatasetStatus.PUBLISHED });
      res.json({ message: 'Dataset published successfully', dataset });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dataset = await DatasetVersion.findByPk(id);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      await dataset.destroy();
      res.json({ message: 'Dataset deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
