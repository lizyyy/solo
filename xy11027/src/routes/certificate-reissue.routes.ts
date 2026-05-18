import { Router, Request, Response } from 'express';
import certificateReissueService from '../services/certificate-reissue.service';

const router = Router();

router.post('/applications', async (req: Request, res: Response) => {
  try {
    const result = await certificateReissueService.创建补办申请(req.body);
    if (result.成功) {
      res.status(201).json({
        成功: true,
        消息: '补办申请提交成功',
        数据: result.数据
      });
    } else {
      res.status(400).json({
        成功: false,
        错误: result.错误
      });
    }
  } catch (error: any) {
    res.status(500).json({
      成功: false,
      错误: {
        错误代码: 'SYSTEM_ERROR',
        错误消息: '系统异常',
        错误详情: error.message,
        建议操作: '请稍后重试，或联系技术支持'
      }
    });
  }
});

router.put('/applications/review', async (req: Request, res: Response) => {
  try {
    const result = await certificateReissueService.审核补办申请(req.body);
    if (result.成功) {
      res.json({
        成功: true,
        消息: '审核完成',
        数据: result.数据
      });
    } else {
      res.status(400).json({
        成功: false,
        错误: result.错误
      });
    }
  } catch (error: any) {
    res.status(500).json({
      成功: false,
      错误: {
        错误代码: 'SYSTEM_ERROR',
        错误消息: '系统异常',
        错误详情: error.message,
        建议操作: '请稍后重试，或联系技术支持'
      }
    });
  }
});

router.get('/applications', async (req: Request, res: Response) => {
  try {
    const { 学员编号, 申请状态, 校区编号 } = req.query;
    const 申请列表 = await certificateReissueService.查询申请列表({
      学员编号: 学员编号 as string,
      申请状态: 申请状态 as string,
      校区编号: 校区编号 as string
    });
    res.json({
      成功: true,
      数据: 申请列表,
      总数: 申请列表.length
    });
  } catch (error: any) {
    res.status(500).json({
      成功: false,
      错误: {
        错误代码: 'SYSTEM_ERROR',
        错误消息: '系统异常',
        错误详情: error.message,
        建议操作: '请稍后重试，或联系技术支持'
      }
    });
  }
});

router.get('/applications/:申请编号', async (req: Request, res: Response) => {
  try {
    const 详情 = await certificateReissueService.获取申请详情(req.params.申请编号);
    if (详情) {
      res.json({
        成功: true,
        数据: 详情
      });
    } else {
      res.status(404).json({
        成功: false,
        错误: {
          错误代码: 'APPLICATION_NOT_FOUND',
          错误消息: '申请不存在',
          错误详情: `申请编号[${req.params.申请编号}]不存在`,
          建议操作: '请核对申请编号'
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({
      成功: false,
      错误: {
        错误代码: 'SYSTEM_ERROR',
        错误消息: '系统异常',
        错误详情: error.message,
        建议操作: '请稍后重试，或联系技术支持'
      }
    });
  }
});

export default router;
