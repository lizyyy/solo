import { Router, Request, Response } from 'express';
import { settlementService } from '../services/settlementService.js';
import { exportService } from '../services/exportService.js';
import type {
  CalculateRoyaltyRequest,
  ExportRequest,
  ApiResponse,
} from '../../shared/types.js';

const router = Router();

router.get('/dashboard', (req: Request, res: Response) => {
  try {
    const data = settlementService.getDashboardData();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.post('/calculate', (req: Request, res: Response) => {
  try {
    const request = req.body as CalculateRoyaltyRequest;
    if (!request.period) {
      return res.status(400).json({
        success: false,
        message: '结算周期(period)是必填参数',
      } as ApiResponse<null>);
    }

    const result = settlementService.calculateRoyalties(request);
    res.json({
      success: true,
      data: result,
    } as ApiResponse<typeof result>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/settlements', (req: Request, res: Response) => {
  try {
    const data = settlementService.getSettlements();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/settlement/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = settlementService.getSettlement(id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: `结算记录 ${id} 不存在`,
      } as ApiResponse<null>);
    }
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.post('/exception/:id/confirm', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator, note } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人(operator)是必填参数',
      } as ApiResponse<null>);
    }
    settlementService.confirmException(id, operator, note);
    res.json({
      success: true,
      message: '异常已确认',
    } as ApiResponse<null>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.post('/settlement/:id/lock', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人(operator)是必填参数',
      } as ApiResponse<null>);
    }
    settlementService.lockSettlement(id, operator);
    res.json({
      success: true,
      message: '结算已锁定',
    } as ApiResponse<null>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.post('/export', (req: Request, res: Response) => {
  try {
    const request = req.body as ExportRequest;
    if (!request.settlementId) {
      return res.status(400).json({
        success: false,
        message: '结算ID(settlementId)是必填参数',
      } as ApiResponse<null>);
    }
    const result = exportService.exportSettlement(request);
    res.json({
      success: true,
      data: result,
    } as ApiResponse<typeof result>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/authors', (req: Request, res: Response) => {
  try {
    const data = settlementService.getAuthors();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/books', (req: Request, res: Response) => {
  try {
    const data = settlementService.getBooks();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/sales', (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const data = settlementService.getSales(period as string | undefined);
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/returns', (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const data = settlementService.getReturns(period as string | undefined);
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/contracts', (req: Request, res: Response) => {
  try {
    const data = settlementService.getContracts();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/ladders', (req: Request, res: Response) => {
  try {
    const data = settlementService.getLadders();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/discounts', (req: Request, res: Response) => {
  try {
    const data = settlementService.getDiscounts();
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

router.get('/audit', (req: Request, res: Response) => {
  try {
    const { settlementId } = req.query;
    const data = settlementService.getAuditLogs(settlementId as string | undefined);
    res.json({
      success: true,
      data,
    } as ApiResponse<typeof data>);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    } as ApiResponse<null>);
  }
});

export default router;
