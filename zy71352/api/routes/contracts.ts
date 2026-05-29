import { Router, Request, Response } from 'express';
import { addContractVersion, compareContractVersions } from '../services/artworkService.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const contract = await addContractVersion(data, operator);

    res.status(201).json({
      success: true,
      data: contract,
      message: '合同版本保存成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Bad request',
    });
  }
});

router.get('/:id/compare', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await compareContractVersions(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
