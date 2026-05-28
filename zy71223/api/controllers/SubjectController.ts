import { Request, Response } from 'express';
import { SubjectRepository } from '../repositories/SubjectRepository';
import { SubjectService } from '../services/SubjectService';
import type { SubjectCategory, Direction } from '../../shared/types';

export class SubjectController {
  static async getSubjects(req: Request, res: Response) {
    try {
      const { category } = req.query;
      const params: any = {};
      if (category) params.category = category as SubjectCategory;
      const subjects = SubjectRepository.findAll(params);
      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createSubject(req: Request, res: Response) {
    try {
      const { code, name, category, direction } = req.body;
      const subject = SubjectRepository.create({
        code,
        name,
        category,
        direction: direction as Direction,
      });
      res.status(201).json(subject);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async validateMapping(req: Request, res: Response) {
    try {
      const { subjectId, direction, amount, description } = req.body;
      const result = SubjectService.validateMapping(
        subjectId,
        direction as Direction,
        parseFloat(amount),
        description || ''
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
