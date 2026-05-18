import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { ApiResponse, Child } from '../models/types';

export const childController = {
  async getAll(req: Request, res: Response) {
    try {
      const children = dataStore.getChildren();
      const response: ApiResponse = {
        success: true,
        data: children,
        metadata: { total: children.length }
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
      const child = dataStore.getChildById(id);

      if (!child) {
        const response: ApiResponse = {
          success: false,
          error: '儿童信息不存在'
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: child
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
      const child: Child = {
        id: uuidv4(),
        name: req.body.name,
        chineseName: req.body.chineseName,
        birthDate: req.body.birthDate,
        gender: req.body.gender,
        classId: req.body.classId,
        className: req.body.className,
        medicalNotes: req.body.medicalNotes,
        allergies: req.body.allergies,
        createdAt: now,
        updatedAt: now
      };

      dataStore.addChild(child);

      const response: ApiResponse = {
        success: true,
        data: child,
        message: '儿童信息创建成功'
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
