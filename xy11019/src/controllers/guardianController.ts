import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { ApiResponse, Guardian } from '../models/types';

export const guardianController = {
  async getAll(req: Request, res: Response) {
    try {
      const { isBlacklisted } = req.query;
      let guardians = dataStore.getGuardians();

      if (isBlacklisted !== undefined) {
        guardians = guardians.filter(g => g.isBlacklisted === (isBlacklisted === 'true'));
      }

      const response: ApiResponse = {
        success: true,
        data: guardians,
        metadata: { total: guardians.length }
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const guardian = dataStore.getGuardianById(id);

      if (!guardian) {
        const response: ApiResponse = {
          success: false,
          error: '接送人信息不存在'
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: guardian
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const now = new Date().toISOString();
      const guardian: Guardian = {
        id: uuidv4(),
        name: req.body.name,
        chineseName: req.body.chineseName,
        phone: req.body.phone,
        alternatePhone: req.body.alternatePhone,
        email: req.body.email,
        idCardNumber: req.body.idCardNumber,
        relationType: req.body.relationType,
        isPrimary: req.body.isPrimary ?? false,
        isBlacklisted: false,
        createdAt: now,
        updatedAt: now
      };

      dataStore.addGuardian(guardian);

      const response: ApiResponse = {
        success: true,
        data: guardian,
        message: '接送人信息创建成功'
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(400).json(response);
    }
  }
};
