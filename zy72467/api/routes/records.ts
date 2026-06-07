import { Router } from 'express';
import type { ApiResponse, FinalRecord } from '../../shared/types';
import { dataStore } from '../data/store';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { status, source } = req.query;
    let records = dataStore.getFinalRecords();

    if (status) {
      records = records.filter(r => r.status === status);
    }
    if (source) {
      records = records.filter(r => r.source === source);
    }

    const response: ApiResponse<FinalRecord[]> = {
      success: true,
      data: records,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取记录失败',
    };
    res.status(500).json(response);
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const record = dataStore.getFinalRecordById(id);

    if (!record) {
      const response: ApiResponse<null> = {
        success: false,
        error: '记录不存在',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<FinalRecord> = {
      success: true,
      data: record,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取记录详情失败',
    };
    res.status(500).json(response);
  }
});

export default router;
