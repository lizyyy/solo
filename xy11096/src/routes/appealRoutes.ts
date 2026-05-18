import express from 'express';
import { Parser } from 'json2csv';
import {
  createAppeal,
  submitAppeal,
  reviewAppeal,
  supplementInfo,
  getAppealById,
  getAllAppeals,
  getAppealStats,
  exportAppealsToCSV
} from '../store/dataStore';
import { CreateAppealRequest, SubmitAppealRequest, ReviewAppealRequest, SupplementInfoRequest } from '../types';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const request: CreateAppealRequest = req.body;
    const result = createAppeal(request);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error?.message,
          suggestions: result.error?.suggestions
        }
      });
    }
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: '申诉创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.post('/submit', (req, res) => {
  try {
    const request: SubmitAppealRequest = req.body;
    const result = submitAppeal(request);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBMIT_ERROR',
          message: result.error?.message,
          suggestions: result.error?.suggestions
        }
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: '申诉提交成功，已进入审核队列'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.post('/review', (req, res) => {
  try {
    const request: ReviewAppealRequest = req.body;
    const result = reviewAppeal(request);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REVIEW_ERROR',
          message: result.error?.message,
          suggestions: result.error?.suggestions
        }
      });
    }
    
    const statusMessages: Record<string, string> = {
      approved: '申诉审核通过',
      rejected: '申诉已驳回',
      needs_more_info: '已要求补充材料'
    };
    
    res.json({
      success: true,
      data: result.data,
      message: statusMessages[result.data?.status || ''] || '审核完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.post('/supplement', (req, res) => {
  try {
    const request: SupplementInfoRequest = req.body;
    const result = supplementInfo(request);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUPPLEMENT_ERROR',
          message: result.error?.message,
          suggestions: result.error?.suggestions
        }
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: '补充材料提交成功，已重新进入审核队列'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const appeal = getAppealById(req.params.id);
    
    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '申诉记录不存在',
          suggestions: ['请检查申诉ID是否正确', '确认该申诉未被删除']
        }
      });
    }
    
    res.json({
      success: true,
      data: appeal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, team, page = '1', limit = '10' } = req.query;
    const filters: any = {};
    if (status) filters.status = status as string;
    if (team) filters.team = team as string;
    
    const allAppeals = getAllAppeals(filters);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedAppeals = allAppeals.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      data: paginatedAppeals,
      meta: {
        total: allAppeals.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(allAppeals.length / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.get('/stats/summary', (req, res) => {
  try {
    const stats = getAppealStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        suggestions: ['请稍后重试', '联系技术支持']
      }
    });
  }
});

router.get('/export/csv', (req, res) => {
  try {
    const { status } = req.query;
    const appeals = exportAppealsToCSV(status as any);
    
    const flatData = appeals.map(appeal => ({
      appealNumber: appeal.appealNumber,
      leagueName: appeal.gameInfo.leagueName,
      homeTeam: appeal.gameInfo.homeTeam,
      awayTeam: appeal.gameInfo.awayTeam,
      gameDate: appeal.gameInfo.gameDate,
      foulType: appeal.foulDetail.foulType,
      foulerName: appeal.foulDetail.fouler.playerName,
      appealingTeam: appeal.appealContent.appealingTeam,
      status: appeal.status,
      consistencyScore: appeal.consistencyScore,
      createdAt: appeal.createdAt,
      resolvedAt: appeal.resolvedAt || ''
    }));
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(flatData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="foul-appeals-${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: '导出失败',
        suggestions: ['请稍后重试', '检查导出格式是否正确']
      }
    });
  }
});

export default router;
