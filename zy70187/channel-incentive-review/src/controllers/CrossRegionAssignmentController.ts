import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { crossRegionAssignmentService, CreateCrossRegionAssignmentRequest } from '../services/CrossRegionAssignmentService';
import { dataStore } from '../repositories/DataStore';

export const CrossRegionAssignmentController = {
  async createAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const result = crossRegionAssignmentService.createAssignment(
        req.body as CreateCrossRegionAssignmentRequest,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async approveAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assignmentId } = req.params;
      const result = crossRegionAssignmentService.approveAssignment(
        assignmentId,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async rejectAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assignmentId } = req.params;
      const { reason } = req.body;
      
      const result = crossRegionAssignmentService.rejectAssignment(
        assignmentId,
        reason,
        req.operator!
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async getAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const { assignmentId } = req.params;
      const assignment = crossRegionAssignmentService.getAssignmentById(assignmentId);

      if (!assignment) {
        return res.status(404).json({
          success: false,
          errorMessage: '跨区归属记录不存在'
        });
      }

      res.json({
        success: true,
        assignment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  },

  async listAssignments(req: AuthenticatedRequest, res: Response) {
    try {
      const { achievementRecordId } = req.query;
      let assignments;
      
      if (achievementRecordId) {
        assignments = crossRegionAssignmentService.getAssignmentsByAchievement(
          achievementRecordId as string
        );
      } else {
        assignments = dataStore.crossRegionAssignments.findAll();
      }

      res.json({
        success: true,
        data: assignments
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errorMessage: (error as Error).message
      });
    }
  }
};
