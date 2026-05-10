import { Router, Request, Response } from 'express';
import { budgetVersionController } from '../controllers/budgetVersionController';
import { departmentSubmissionController } from '../controllers/departmentSubmissionController';
import { lockWindowController } from '../controllers/lockWindowController';
import { differenceNoteController } from '../controllers/differenceNoteController';
import { forecastReportController } from '../controllers/forecastReportController';
import { sendSuccess } from '../utils/response';
import { stateMachineService } from '../services/stateMachine';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  sendSuccess(res, '预算滚动预测锁定 API 系统运行正常', {
    name: 'Budget Rolling Forecast Locking API',
    version: '1.0.0',
    description: '预算滚动预测锁定 API 系统，支持预算版本管理、部门提交、锁定窗口、差异说明、回退审批、预测报表等功能',
    endpoints: {
      budgetVersions: '/api/budget-versions',
      departmentSubmissions: '/api/department-submissions',
      lockWindows: '/api/lock-windows',
      differenceNotes: '/api/difference-notes',
      forecastReports: '/api/forecast-reports'
    }
  });
});

router.get('/status-machine', (req: Request, res: Response) => {
  sendSuccess(res, '状态机配置信息', {
    budgetVersionTransitions: stateMachineService.getAllBudgetVersionTransitions(),
    departmentSubmissionTransitions: stateMachineService.getAllDepartmentSubmissionTransitions(),
    lockWindowTransitions: stateMachineService.getAllLockWindowTransitions()
  });
});

const budgetVersionRouter = Router();
budgetVersionRouter.post('/', budgetVersionController.create.bind(budgetVersionController));
budgetVersionRouter.get('/', budgetVersionController.list.bind(budgetVersionController));
budgetVersionRouter.get('/:id', budgetVersionController.getById.bind(budgetVersionController));
budgetVersionRouter.post('/:id/submit', budgetVersionController.submit.bind(budgetVersionController));
budgetVersionRouter.post('/:id/review', budgetVersionController.review.bind(budgetVersionController));
budgetVersionRouter.post('/:id/approve', budgetVersionController.approve.bind(budgetVersionController));
budgetVersionRouter.post('/:id/reject', budgetVersionController.reject.bind(budgetVersionController));
budgetVersionRouter.post('/:id/lock', budgetVersionController.lock.bind(budgetVersionController));
budgetVersionRouter.post('/:id/request-rollback', budgetVersionController.requestRollback.bind(budgetVersionController));
budgetVersionRouter.post('/:id/approve-rollback', budgetVersionController.approveRollback.bind(budgetVersionController));
budgetVersionRouter.post('/:id/reject-rollback', budgetVersionController.rejectRollback.bind(budgetVersionController));
router.use('/api/budget-versions', budgetVersionRouter);

const departmentSubmissionRouter = Router();
departmentSubmissionRouter.post('/', departmentSubmissionController.create.bind(departmentSubmissionController));
departmentSubmissionRouter.get('/', departmentSubmissionController.list.bind(departmentSubmissionController));
departmentSubmissionRouter.get('/:id', departmentSubmissionController.getById.bind(departmentSubmissionController));
departmentSubmissionRouter.post('/:id/submit', departmentSubmissionController.submit.bind(departmentSubmissionController));
departmentSubmissionRouter.post('/:id/review', departmentSubmissionController.review.bind(departmentSubmissionController));
departmentSubmissionRouter.post('/:id/approve', departmentSubmissionController.approve.bind(departmentSubmissionController));
departmentSubmissionRouter.post('/:id/reject', departmentSubmissionController.reject.bind(departmentSubmissionController));
departmentSubmissionRouter.post('/:id/resubmit', departmentSubmissionController.resubmit.bind(departmentSubmissionController));
departmentSubmissionRouter.put('/:id/data', departmentSubmissionController.updateData.bind(departmentSubmissionController));
router.use('/api/department-submissions', departmentSubmissionRouter);

const lockWindowRouter = Router();
lockWindowRouter.post('/', lockWindowController.create.bind(lockWindowController));
lockWindowRouter.get('/', lockWindowController.list.bind(lockWindowController));
lockWindowRouter.get('/active/:budgetVersionId', lockWindowController.getActive.bind(lockWindowController));
lockWindowRouter.get('/:id', lockWindowController.getById.bind(lockWindowController));
lockWindowRouter.post('/:id/close', lockWindowController.close.bind(lockWindowController));
lockWindowRouter.post('/:id/reopen', lockWindowController.reopen.bind(lockWindowController));
lockWindowRouter.post('/:id/lock', lockWindowController.lock.bind(lockWindowController));
lockWindowRouter.post('/:id/extend', lockWindowController.extend.bind(lockWindowController));
router.use('/api/lock-windows', lockWindowRouter);

const differenceNoteRouter = Router();
differenceNoteRouter.post('/', differenceNoteController.create.bind(differenceNoteController));
differenceNoteRouter.get('/submission/:submissionId', differenceNoteController.listBySubmission.bind(differenceNoteController));
differenceNoteRouter.get('/budget-version/:budgetVersionId', differenceNoteController.listByBudgetVersion.bind(differenceNoteController));
differenceNoteRouter.get('/summary/:budgetVersionId', differenceNoteController.getSummary.bind(differenceNoteController));
differenceNoteRouter.get('/:id', differenceNoteController.getById.bind(differenceNoteController));
differenceNoteRouter.delete('/:id', differenceNoteController.delete.bind(differenceNoteController));
router.use('/api/difference-notes', differenceNoteRouter);

const forecastReportRouter = Router();
forecastReportRouter.post('/', forecastReportController.generate.bind(forecastReportController));
forecastReportRouter.get('/', forecastReportController.list.bind(forecastReportController));
forecastReportRouter.get('/latest-affecting/:budgetVersionId', forecastReportController.getLatestAffecting.bind(forecastReportController));
forecastReportRouter.get('/final-result/:budgetVersionId', forecastReportController.getBudgetFinalResult.bind(forecastReportController));
forecastReportRouter.get('/:id', forecastReportController.getById.bind(forecastReportController));
forecastReportRouter.put('/:id/affects-final-result', forecastReportController.updateAffectsFinalResult.bind(forecastReportController));
forecastReportRouter.delete('/:id', forecastReportController.delete.bind(forecastReportController));
router.use('/api/forecast-reports', forecastReportRouter);

export default router;
