import { Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import { QueryFilters } from '../types/interfaces';

const exportService = new ExportService();

export const exportRegistrations = async (req: Request, res: Response) => {
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

    const [csv, count] = await Promise.all([
      exportService.exportRegistrations(filters),
      exportService.getRegistrationExportCount(filters),
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registrations_${Date.now()}.csv"`);
    res.setHeader('X-Total-Count', count.toString());

    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const exportWaitlist = async (req: Request, res: Response) => {
  try {
    const { activityId, isPromoted } = req.query;

    if (!activityId) {
      return res.status(400).json({ error: '请提供活动ID' });
    }

    const csv = await exportService.exportWaitlist(
      activityId as string,
      isPromoted !== undefined ? isPromoted === 'true' : undefined
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="waitlist_${Date.now()}.csv"`);

    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const exportAttendance = async (req: Request, res: Response) => {
  try {
    const { activityId, status } = req.query;

    if (!activityId) {
      return res.status(400).json({ error: '请提供活动ID' });
    }

    const csv = await exportService.exportAttendance(
      activityId as string,
      status as string | undefined
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${Date.now()}.csv"`);

    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const exportFullReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const report = await exportService.exportFullReport(id);

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getExportCount = async (req: Request, res: Response) => {
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

    const count = await exportService.getRegistrationExportCount(filters);

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
