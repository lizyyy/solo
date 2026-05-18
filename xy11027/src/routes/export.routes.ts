import { Router, Request, Response } from 'express';
import exportService from '../services/export.service';

const router = Router();

router.get('/applications', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
    const 数据 = await exportService.导出补办申请数据(format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="证书补办申请_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + 数据);
    } else {
      res.json({
        成功: true,
        消息: '数据导出成功',
        ...数据
      });
    }
  } catch (error: any) {
    res.status(500).json({
      成功: false,
      错误: {
        错误代码: 'EXPORT_ERROR',
        错误消息: '导出失败',
        错误详情: error.message,
        建议操作: '请稍后重试'
      }
    });
  }
});

router.get('/student/:学员编号/certificates', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
    const 数据 = await exportService.导出学员证书记录(req.params.学员编号, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="学员证书记录_${req.params.学员编号}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + 数据);
    } else {
      res.json({
        成功: true,
        消息: '数据导出成功',
        ...数据
      });
    }
  } catch (error: any) {
    res.status(500).json({
      成功: false,
      错误: {
        错误代码: 'EXPORT_ERROR',
        错误消息: '导出失败',
        错误详情: error.message,
        建议操作: '请稍后重试'
      }
    });
  }
});

export default router;
