import { Request, Response } from 'express';
import { dataStore } from '../data/store';
import { authorizationService, CreateAuthorizationRequest, UpdateStatusRequest } from '../services/authorizationService';
import { ApiResponse, AuthorizationStatus } from '../models/types';

export const authorizationController = {
  async getAll(req: Request, res: Response) {
    try {
      const { childId, guardianId, status } = req.query;
      let authorizations = dataStore.getAuthorizations();

      if (childId) {
        authorizations = authorizations.filter(a => a.childId === childId);
      }
      if (guardianId) {
        authorizations = authorizations.filter(a => a.guardianId === guardianId);
      }
      if (status) {
        authorizations = authorizations.filter(a => a.status === status);
      }

      const response: ApiResponse = {
        success: true,
        data: authorizations,
        metadata: { total: authorizations.length }
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
      const authorization = dataStore.getAuthorizationById(id);

      if (!authorization) {
        const response: ApiResponse = {
          success: false,
          error: '授权记录不存在'
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: authorization
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
      const request: CreateAuthorizationRequest = req.body;
      const authorization = authorizationService.createAuthorization(request);

      const response: ApiResponse = {
        success: true,
        data: authorization,
        message: '授权创建成功'
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(400).json(response);
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const request: UpdateStatusRequest = {
        id: req.params.id,
        ...req.body
      };
      const authorization = authorizationService.updateAuthorizationStatus(request);

      const response: ApiResponse = {
        success: true,
        data: authorization,
        message: '状态更新成功'
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(400).json(response);
    }
  },

  async checkConsistency(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = authorizationService.getAuthorizationConsistency(id);

      const response: ApiResponse = {
        success: true,
        data: result
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(400).json(response);
    }
  },

  async validatePickup(req: Request, res: Response) {
    try {
      const { guardianId, childId } = req.query;
      const result = authorizationService.validatePickup(
        guardianId as string,
        childId as string
      );

      const response: ApiResponse = {
        success: true,
        data: result
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(400).json(response);
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = dataStore.deleteAuthorization(id);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          error: '授权记录不存在'
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse = {
        success: true,
        message: '授权记录已删除'
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
      res.status(500).json(response);
    }
  }
};
