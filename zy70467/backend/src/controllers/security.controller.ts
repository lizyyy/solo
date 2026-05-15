import { Request, Response } from 'express';
import { securityService } from '../services/security.service';
import { asyncHandler } from '../middleware/errorHandler';

export const createCandidateList = asyncHandler(async (req: Request, res: Response) => {
  const { type, batchIds, reason, requestedBy } = req.body;
  const result = await securityService.createCandidateList({
    type,
    batchIds,
    reason,
    requestedBy: requestedBy || 'admin',
  });
  res.status(201).json({ success: true, data: result });
});

export const approveCandidateList = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { approved, approvedBy, comment } = req.body;
  const result = await securityService.approveCandidateList(
    id,
    approved,
    approvedBy || 'admin',
    comment
  );
  res.json({ success: true, data: result });
});

export const executeCandidateList = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { executedBy } = req.body;
  const result = await securityService.executeCandidateList(
    id,
    executedBy || 'admin'
  );
  res.json({ success: true, data: result });
});

export const getCandidateLists = asyncHandler(async (req: Request, res: Response) => {
  const { type, status, page, pageSize } = req.query;
  const result = await securityService.getCandidateLists({
    type: type as string,
    status: status as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json({ success: true, data: result });
});
