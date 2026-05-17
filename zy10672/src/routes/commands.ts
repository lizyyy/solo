import { Router, Request, Response } from 'express';
import { CommandService } from '../services/commandService';
import { AuditService } from '../services/auditService';
import { ApiResponse, CommandStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const {
    requestId,
    title,
    command,
    hostGroupId,
    executionWindowStart,
    executionWindowEnd,
    submitterId,
    submitterName,
    requiredApprovalCount
  } = req.body;

  const result = await CommandService.submitCommand(
    requestId,
    title,
    command,
    hostGroupId,
    new Date(executionWindowStart),
    new Date(executionWindowEnd),
    submitterId,
    submitterName,
    requiredApprovalCount
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.status(201).json(response);
});

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as CommandStatus | undefined;
  const submitterId = req.query.submitterId as string | undefined;
  const hostGroupId = req.query.hostGroupId as string | undefined;

  const result = await CommandService.listCommands(page, pageSize, {
    status,
    submitterId,
    hostGroupId
  });

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.get('/:id', async (req: Request, res: Response) => {
  const result = await CommandService.getCommand(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const { approverId, approverName, remark } = req.body;

  const result = await CommandService.approveCommand(
    req.params.id,
    approverId,
    approverName,
    remark
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.get('/:id/approvals', async (req: Request, res: Response) => {
  const result = await CommandService.getCommandApprovals(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/start', async (req: Request, res: Response) => {
  const { operatorId, operatorName } = req.body;

  const result = await CommandService.startExecution(
    req.params.id,
    operatorId,
    operatorName
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/manual-remark', async (req: Request, res: Response) => {
  const { operatorId, operatorName, remark } = req.body;

  const result = await CommandService.manualRemarkAfterExpired(
    req.params.id,
    operatorId,
    operatorName,
    remark
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/continue-after-expired', async (req: Request, res: Response) => {
  const { operatorId, operatorName, remark } = req.body;

  const result = await CommandService.continueAfterExpired(
    req.params.id,
    operatorId,
    operatorName,
    remark
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/terminate', async (req: Request, res: Response) => {
  const { operatorId, operatorName, reason } = req.body;

  const result = await CommandService.terminateCommand(
    req.params.id,
    operatorId,
    operatorName,
    reason
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/complete', async (req: Request, res: Response) => {
  const { successHosts, failedHosts } = req.body;

  const result = await CommandService.completeExecution(
    req.params.id,
    parseInt(successHosts),
    parseInt(failedHosts)
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.get('/:id/history', async (req: Request, res: Response) => {
  const result = await AuditService.getCommandHistory(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.get('/:id/executions', async (req: Request, res: Response) => {
  const result = await CommandService.getExecutionRecords(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.post('/:id/agent-report', async (req: Request, res: Response) => {
  const {
    hostAddress,
    status,
    exitCode,
    stdout,
    stderr,
    startedAt,
    finishedAt
  } = req.body;

  await CommandService.reportAgentExecution(
    req.params.id,
    hostAddress,
    status,
    exitCode,
    stdout,
    stderr,
    startedAt ? new Date(startedAt) : undefined,
    finishedAt ? new Date(finishedAt) : undefined
  );

  const response: ApiResponse = {
    success: true,
    data: { message: '执行结果已上报' }
  };
  res.json(response);
});

export default router;
