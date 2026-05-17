import { Router, Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import { importExportService } from '../services/import-export.service';
import { ApiResponse, ErrorCode } from '../types';

const router = Router();

const handleError = (res: Response, error: any, statusCode: number = 400) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: error.code || ErrorCode.INTERNAL_ERROR,
      message: error.message || '内部错误',
      details: error.details
    }
  };
  res.status(statusCode).json(response);
};

const handleSuccess = (res: Response, data: any, statusCode: number = 200) => {
  const response: ApiResponse = { success: true, data };
  res.status(statusCode).json(response);
};

router.post('/', (req: Request, res: Response) => {
  try {
    const result = appointmentService.createAppointment(req.body);
    if (result.success) {
      handleSuccess(res, result.data, 201);
    } else {
      handleError(res, result.error, 400);
    }
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, indexName } = req.query;
    const appointments = appointmentService.listAppointments({
      status: status as string,
      indexName: indexName as string
    });
    handleSuccess(res, appointments);
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const appointment = appointmentService.getAppointment(req.params.id);
    if (!appointment) {
      handleError(res, { code: ErrorCode.APPOINTMENT_NOT_FOUND, message: '预约记录不存在' }, 404);
      return;
    }
    handleSuccess(res, appointment);
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.get('/:id/histories', (req: Request, res: Response) => {
  try {
    const histories = appointmentService.getAppointmentHistories(req.params.id);
    handleSuccess(res, histories);
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.post('/:id/lock', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const result = appointmentService.lockWindow(req.params.id, operator);
    if (result.success) {
      handleSuccess(res, result.data);
    } else {
      handleError(res, result.error, 400);
    }
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.post('/:id/start-rebuild', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const result = appointmentService.startRebuild(req.params.id, operator);
    if (result.success) {
      handleSuccess(res, result.data);
    } else {
      handleError(res, result.error, 400);
    }
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const result = appointmentService.completeRebuild(req.params.id, operator);
    if (result.success) {
      handleSuccess(res, result.data);
    } else {
      handleError(res, result.error, 400);
    }
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    const result = appointmentService.reject(req.params.id, operator, reason);
    if (result.success) {
      handleSuccess(res, result.data);
    } else {
      handleError(res, result.error, 400);
    }
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.post('/:id/manual-review', (req: Request, res: Response) => {
  try {
    const { operator, remark } = req.body;
    const result = appointmentService.requestManualReview(req.params.id, operator, remark);
    if (result.success) {
      handleSuccess(res, result.data);
    } else {
      handleError(res, result.error, 400);
    }
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { filePath, createdBy } = req.body;
    const result = await importExportService.importFromCSV(filePath, createdBy);
    handleSuccess(res, result);
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

router.get('/export/download', (req: Request, res: Response) => {
  try {
    const { outputPath } = req.query;
    const appointments = appointmentService.listAppointments();
    importExportService.exportToCSV(appointments, outputPath as string);
    handleSuccess(res, { message: '导出成功', path: outputPath });
  } catch (error) {
    handleError(res, { code: ErrorCode.INTERNAL_ERROR, message: error instanceof Error ? error.message : '未知错误' }, 500);
  }
});

export default router;
