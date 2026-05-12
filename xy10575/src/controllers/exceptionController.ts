import { Request, Response } from 'express';
import { exceptionService } from '../services/exceptionService';
import { AppResponse, RecheckStatus } from '../models';
import { BusinessError } from '../services/equipmentService';

function handleError(res: Response, error: any) {
  if (error instanceof BusinessError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      errorCode: error.code
    } as AppResponse<null>);
  }
  console.error(error);
  return res.status(500).json({
    success: false,
    error: '服务器内部错误'
  } as AppResponse<null>);
}

function getOperator(req: Request): { id: string; name: string } {
  return {
    id: req.headers['x-operator-id'] as string || 'system',
    name: req.headers['x-operator-name'] as string || '系统管理员'
  };
}

export async function reportException(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const exception = await exceptionService.reportException(req.body, operator);
    res.json({ success: true, data: exception } as AppResponse<typeof exception>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getException(req: Request, res: Response) {
  try {
    const exception = await exceptionService.getExceptionById(req.params.id);
    if (!exception) {
      return res.status(404).json({ success: false, error: '异常记录不存在' } as AppResponse<null>);
    }
    res.json({ success: true, data: exception } as AppResponse<typeof exception>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getAllExceptions(req: Request, res: Response) {
  try {
    const { equipmentId, status, inspectionId } = req.query;
    const exceptions = await exceptionService.getAllExceptions({
      equipmentId: equipmentId as string,
      status: status as string,
      inspectionId: inspectionId as string
    });
    res.json({ success: true, data: exceptions } as AppResponse<typeof exceptions>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createDowntime(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const downtime = await exceptionService.createDowntime(req.body, operator);
    res.json({ success: true, data: downtime } as AppResponse<typeof downtime>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function endDowntime(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const downtime = await exceptionService.endDowntime(req.params.id, operator);
    res.json({ success: true, data: downtime } as AppResponse<typeof downtime>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getAllDowntime(req: Request, res: Response) {
  try {
    const { equipmentId, status, exceptionId } = req.query;
    const downtimes = await exceptionService.getAllDowntime({
      equipmentId: equipmentId as string,
      status: status as string,
      exceptionId: exceptionId as string
    });
    res.json({ success: true, data: downtimes } as AppResponse<typeof downtimes>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function assignMaintenance(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const maintenance = await exceptionService.assignMaintenance(req.body, operator);
    res.json({ success: true, data: maintenance } as AppResponse<typeof maintenance>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function startMaintenance(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const maintenance = await exceptionService.startMaintenance(req.params.id, operator);
    res.json({ success: true, data: maintenance } as AppResponse<typeof maintenance>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function completeMaintenance(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const { result } = req.body;
    const maintenance = await exceptionService.completeMaintenance(req.params.id, result, operator);
    res.json({ success: true, data: maintenance } as AppResponse<typeof maintenance>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getMaintenance(req: Request, res: Response) {
  try {
    const maintenance = await exceptionService.getMaintenanceById(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ success: false, error: '维修任务不存在' } as AppResponse<null>);
    }
    res.json({ success: true, data: maintenance } as AppResponse<typeof maintenance>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getMaintenanceByException(req: Request, res: Response) {
  try {
    const maintenances = await exceptionService.getMaintenanceByException(req.params.exceptionId);
    res.json({ success: true, data: maintenances } as AppResponse<typeof maintenances>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function recheckException(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const { result, remark, idempotentKey } = req.body;
    const recheck = await exceptionService.recheck(
      {
        exceptionId: req.params.id,
        result: result as RecheckStatus,
        remark,
        idempotentKey
      },
      operator
    );
    res.json({ success: true, data: recheck } as AppResponse<typeof recheck>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getRechecksByException(req: Request, res: Response) {
  try {
    const rechecks = await exceptionService.getRechecksByException(req.params.exceptionId);
    res.json({ success: true, data: rechecks } as AppResponse<typeof rechecks>);
  } catch (error) {
    handleError(res, error);
  }
}

export async function manualCorrection(req: Request, res: Response) {
  try {
    const operator = getOperator(req);
    const { entityType, entityId, correction } = req.body;
    await exceptionService.manualCorrection(entityType, entityId, correction, operator);
    res.json({ success: true, data: { message: '人工修正记录已保存' } });
  } catch (error) {
    handleError(res, error);
  }
}
