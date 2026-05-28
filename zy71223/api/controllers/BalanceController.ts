import { Request, Response } from 'express';
import { BalanceRepository } from '../repositories/BalanceRepository';
import { BalanceService } from '../services/BalanceService';

export class BalanceController {
  static async getBalances(req: Request, res: Response) {
    try {
      const { period } = req.query;
      const currentPeriod = period as string || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const balances = BalanceRepository.findAll(currentPeriod);
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async calculateBalances(req: Request, res: Response) {
    try {
      const { period } = req.body;
      const currentPeriod = period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const balances = BalanceService.calculateBalances(currentPeriod);
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async verifyBalances(req: Request, res: Response) {
    try {
      const { period } = req.query;
      const currentPeriod = period as string || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      BalanceService.calculateBalances(currentPeriod);
      const warnings = BalanceService.verifyBalances(currentPeriod);
      res.json({ warnings });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getPeriods(req: Request, res: Response) {
    try {
      const periods = BalanceRepository.getAvailablePeriods();
      res.json(periods);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
