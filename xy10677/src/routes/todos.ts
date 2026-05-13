import express, { Request, Response } from 'express';
import { TreatmentService } from '../services/treatment';
import { TodoStatus } from '../types';

export const createTodoRouter = (treatmentService: TreatmentService) => {
  const router = express.Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { assigneeId, status } = req.query;
      const todos = await treatmentService.getAllTodos(
        assigneeId as string,
        status as TodoStatus
      );
      res.json({ success: true, data: todos });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.put('/:id/complete', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { completedBy, completedByName, reason } = req.body;
      const todo = await treatmentService.completeTodo(
        id,
        completedBy || 'admin',
        completedByName || '管理员',
        reason
      );
      if (!todo) {
        return res.status(404).json({ success: false, error: 'Todo not found' });
      }
      res.json({ success: true, data: todo });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
};

export default createTodoRouter;
