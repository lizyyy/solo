import express, { Request, Response } from 'express';
import { importService } from '../services/importService';

const router = express.Router();

router.post('/tasks', (req: Request, res: Response) => {
  try {
    const {
      fileName,
      fileSize,
      fileType,
      totalRows,
      chunkSize,
      createdBy,
      businessType,
      description
    } = req.body;

    const task = importService.createTask(
      fileName,
      fileSize,
      fileType,
      totalRows,
      chunkSize,
      createdBy,
      businessType,
      description
    );

    res.status(201).json({
      success: true,
      data: task,
      message: '导入任务创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '创建任务失败'
    });
  }
});

router.get('/tasks', (req: Request, res: Response) => {
  try {
    const tasks = importService.getAllTasks();
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '获取任务列表失败'
    });
  }
});

router.get('/tasks/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = importService.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '获取任务失败'
    });
  }
});

router.get('/tasks/:taskId/chunks', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const chunks = importService.getTaskChunks(taskId);
    
    res.json({
      success: true,
      data: chunks
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '获取分片信息失败'
    });
  }
});

router.post('/tasks/:taskId/upload', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    importService.startUpload(taskId);
    
    res.json({
      success: true,
      message: '开始上传'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '启动上传失败'
    });
  }
});

router.post('/tasks/:taskId/process', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    importService.startProcessing(taskId);
    
    res.json({
      success: true,
      message: '开始处理'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '启动处理失败'
    });
  }
});

router.post('/tasks/:taskId/chunks/:chunkId/process', async (req: Request, res: Response) => {
  try {
    const { taskId, chunkId } = req.params;
    const { rowsData } = req.body;

    await importService.processChunk(
      taskId,
      chunkId,
      async (rowData: string, rowNumber: number) => {
        const mockSuccess = rowNumber % 10 !== 0;
        return {
          success: mockSuccess,
          businessKey: `BK-${rowNumber}`,
          recordId: mockSuccess ? `REC-${Date.now()}-${rowNumber}` : undefined,
          errorCode: mockSuccess ? undefined : 'MOCK_ERROR',
          errorMessage: mockSuccess ? undefined : '模拟处理失败'
        };
      },
      rowsData
    );

    res.json({
      success: true,
      message: '分片处理完成'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '分片处理失败'
    });
  }
});

router.post('/tasks/:taskId/failed', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    importService.markTaskFailed(taskId);
    
    res.json({
      success: true,
      message: '任务标记为失败'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '标记任务失败状态失败'
    });
  }
});

router.post('/tasks/:taskId/needs-fix', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    importService.markTaskNeedsManualFix(taskId);
    
    res.json({
      success: true,
      message: '任务标记为需要人工修正'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '标记任务状态失败'
    });
  }
});

router.post('/tasks/:taskId/resume', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const summary = importService.resumeTask(taskId);
    
    res.json({
      success: true,
      data: summary,
      message: '任务续传成功启动'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '续传任务失败'
    });
  }
});

router.get('/tasks/:taskId/resume-summary', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const summary = importService.getResumeSummary(taskId);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '获取续传摘要失败'
    });
  }
});

router.post('/tasks/:taskId/failures/:rowNumber/fix', (req: Request, res: Response) => {
  try {
    const { taskId, rowNumber } = req.params;
    const { fixedBy, fixNote } = req.body;

    const result = importService.manualFixFailure(
      taskId,
      parseInt(rowNumber),
      fixedBy,
      fixNote
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: '失败记录不存在'
      });
    }

    res.json({
      success: true,
      data: result,
      message: '人工修正成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '人工修正失败'
    });
  }
});

router.get('/tasks/:taskId/successes', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const details = importService.getSuccessDetails(taskId);
    
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '获取成功明细失败'
    });
  }
});

router.get('/tasks/:taskId/failures', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const details = importService.getFailureDetails(taskId);
    
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '获取失败明细失败'
    });
  }
});

router.get('/tasks/:taskId/export', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const exportData = importService.exportBusinessData(taskId);
    
    res.json({
      success: true,
      data: exportData,
      message: '导出成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '导出失败'
    });
  }
});

router.post('/tasks/:taskId/chunks/:chunkIndex/retry', (req: Request, res: Response) => {
  try {
    const { taskId, chunkIndex } = req.params;
    importService.retryFailedChunk(taskId, parseInt(chunkIndex));
    
    res.json({
      success: true,
      message: '分片重试已启动'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '分片重试失败'
    });
  }
});

export default router;
