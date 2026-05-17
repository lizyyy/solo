import { Router, Request, Response } from 'express';
import { HostGroupService } from '../services/hostGroupService';
import { ApiResponse } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { name, description, hosts, createdBy } = req.body;

  const result = await HostGroupService.createHostGroup(
    name,
    description,
    hosts,
    createdBy
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

  const result = await HostGroupService.listHostGroups(page, pageSize);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.get('/:id', async (req: Request, res: Response) => {
  const result = await HostGroupService.getHostGroup(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, hosts } = req.body;

  const result = await HostGroupService.updateHostGroup(req.params.id, {
    name,
    description,
    hosts
  });

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await HostGroupService.deleteHostGroup(req.params.id);

  const response: ApiResponse = {
    success: true,
    data: { message: '删除成功' }
  };
  res.json(response);
});

router.post('/import', async (req: Request, res: Response) => {
  const { records, importedBy } = req.body;

  const result = await HostGroupService.importCommandsFromCSV(
    records,
    importedBy
  );

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.status(201).json(response);
});

router.get('/import/:batchId', async (req: Request, res: Response) => {
  const result = await HostGroupService.getImportRecord(req.params.batchId);

  const response: ApiResponse = {
    success: true,
    data: result
  };
  res.json(response);
});

export default router;
