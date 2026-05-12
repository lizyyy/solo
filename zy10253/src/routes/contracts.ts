import { Router, Request, Response } from 'express';
import { 
  getContractById, 
  getContractByNo, 
  getInstallmentsByContractId, 
  getAttendancesByContractId, 
  getSchedulesByContractId,
  createContract,
  updateContract,
  createSchedule,
  updateScheduleStatus,
  createAttendance,
  createInstallment,
  payInstallment
} from '../services/contractService';

const router = Router();

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const { operator_id, operator_name, ...contractData } = req.body;
    const contract = await createContract(contractData, operator_id, operator_name);
    res.json({
      success: true,
      data: contract
    });
  } catch (err) {
    next(err);
  }
});

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

router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const { operator_id, operator_name, ...updateData } = req.body;
    await updateContract(req.params.id, updateData, operator_id, operator_name);
    res.json({
      success: true,
      message: '合同更新成功'
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

router.post('/:id/installments', async (req: Request, res: Response, next) => {
  try {
    const { operator_id, operator_name, ...installmentData } = req.body;
    const installment = await createInstallment({ ...installmentData, contract_id: req.params.id }, operator_id, operator_name);
    res.json({
      success: true,
      data: installment
    });
  } catch (err) {
    next(err);
  }
});

router.post('/installments/:installmentId/pay', async (req: Request, res: Response, next) => {
  try {
    const { operator_id, operator_name } = req.body;
    await payInstallment(req.params.installmentId, operator_id, operator_name);
    res.json({
      success: true,
      message: '分期支付成功'
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

router.post('/:id/attendances', async (req: Request, res: Response, next) => {
  try {
    const { schedule_id, is_gifted, operator_id, operator_name } = req.body;
    const attendance = await createAttendance(schedule_id, req.params.id, is_gifted || 0, operator_id, operator_name);
    res.json({
      success: true,
      data: attendance
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

router.post('/:id/schedules', async (req: Request, res: Response, next) => {
  try {
    const { operator_id, operator_name, ...scheduleData } = req.body;
    const schedule = await createSchedule({ ...scheduleData, contract_id: req.params.id }, operator_id, operator_name);
    res.json({
      success: true,
      data: schedule
    });
  } catch (err) {
    next(err);
  }
});

router.put('/schedules/:scheduleId/status', async (req: Request, res: Response, next) => {
  try {
    const { status, operator_id, operator_name } = req.body;
    await updateScheduleStatus(req.params.scheduleId, status, operator_id, operator_name);
    res.json({
      success: true,
      message: '排课状态更新成功'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
