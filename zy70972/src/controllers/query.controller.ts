import { Request, Response } from 'express';
import { QueryService } from '../services/query.service';
import { QueryFilters } from '../types/interfaces';

const queryService = new QueryService();

export const getRegistrations = async (req: Request, res: Response) => {
  try {
    const {
      activityId,
      status,
      isDuplicate,
      isBlacklisted,
      isPromoted,
      startDate,
      endDate,
      community,
      page = '1',
      pageSize = '50',
    } = req.query;

    const filters: QueryFilters = {
      activityId: activityId as string | undefined,
      status: status as string | undefined,
      isDuplicate: isDuplicate !== undefined ? isDuplicate === 'true' : undefined,
      isBlacklisted: isBlacklisted !== undefined ? isBlacklisted === 'true' : undefined,
      isPromoted: isPromoted !== undefined ? isPromoted === 'true' : undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      community: community as string | undefined,
    };

    const result = await queryService.getRegistrations(
      filters,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getRegistrationDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const detail = await queryService.getRegistrationDetail(id);

    if (!detail) {
      return res.status(404).json({ error: '报名记录不存在' });
    }

    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getWaitlistEntries = async (req: Request, res: Response) => {
  try {
    const { activityId, isPromoted, page = '1', pageSize = '50' } = req.query;

    if (!activityId) {
      return res.status(400).json({ error: '请提供活动ID' });
    }

    const result = await queryService.getWaitlistEntries(
      activityId as string,
      isPromoted !== undefined ? isPromoted === 'true' : undefined,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getAttendanceRecords = async (req: Request, res: Response) => {
  try {
    const { activityId, status, page = '1', pageSize = '50' } = req.query;

    if (!activityId) {
      return res.status(400).json({ error: '请提供活动ID' });
    }

    const result = await queryService.getAttendanceRecords(
      activityId as string,
      status as string | undefined,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getActivitySummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const summary = await queryService.getActivitySummary(id);

    if (!summary) {
      return res.status(404).json({ error: '活动不存在' });
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getProcessingHistory = async (req: Request, res: Response) => {
  try {
    const { registrationId, waitlistEntryId } = req.query;

    if (!registrationId && !waitlistEntryId) {
      return res.status(400).json({ error: '请提供报名记录ID或候补记录ID' });
    }

    const history = await queryService.getProcessingHistory(
      registrationId as string | undefined,
      waitlistEntryId as string | undefined
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { batchId, page = '1', pageSize = '50' } = req.query;

    const result = await queryService.getAuditLogs(
      batchId as string | undefined,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
