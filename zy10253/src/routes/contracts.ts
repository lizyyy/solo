import { Router, Request, Response } from 'express';
import { getContractById, getContractByNo, getInstallmentsByContractId, getAttendancesByContractId, getSchedulesByContractId } from '../services/contractService';

const router = Router();

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const contract = await getContractById(req.params.id);
    res.json({
      success: true,
      data: contract
    });
  } catch (err) {
    next(err);
  }
});

router.get('/no/:contractNo', async (req: Request, res: Response, next) => {
  try {
    const contract = await getContractByNo(req.params.contractNo);
    res.json({
      success: true,
      data: contract
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/installments', async (req: Request, res: Response, next) => {
  try {
    const installments = await getInstallmentsByContractId(req.params.id);
    res.json({
      success: true,
      data: installments
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/attendances', async (req: Request, res: Response, next) => {
  try {
    const attendances = await getAttendancesByContractId(req.params.id);
    res.json({
      success: true,
      data: attendances
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/schedules', async (req: Request, res: Response, next) => {
  try {
    const schedules = await getSchedulesByContractId(req.params.id);
    res.json({
      success: true,
      data: schedules
    });
  } catch (err) {
    next(err);
  }
});

export default router;
