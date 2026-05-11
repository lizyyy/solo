import { Router, Request, Response } from 'express';
import { prescriptionService } from '../services/prescriptionService';
import {
  CreateConsultationRequest,
  CreatePrescriptionRequest,
  PharmacistReviewRequest,
  PaymentConfirmRequest,
  ShipRequest,
  RejectCancelRequest
} from '../types';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(500).json({ success: false, message: '服务器错误', error: err.message });
    });
  };
};

router.post('/consultation', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.createConsultation(req.body as CreateConsultationRequest);
  res.json(result);
}));

router.post('/prescription', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.createPrescription(req.body as CreatePrescriptionRequest);
  res.json(result);
}));

router.post('/pharmacist-review', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.pharmacistReview(req.body as PharmacistReviewRequest);
  res.json(result);
}));

router.post('/payment', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.confirmPayment(req.body as PaymentConfirmRequest);
  res.json(result);
}));

router.post('/ship', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.ship(req.body as ShipRequest);
  res.json(result);
}));

router.post('/cancel', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.cancelOrReject(req.body as RejectCancelRequest);
  res.json(result);
}));

router.get('/consultation/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await prescriptionService.getConsultation(req.params.id);
  res.json(result);
}));

router.get('/summary', asyncHandler(async (_req: Request, res: Response) => {
  const result = await prescriptionService.getStatusSummary();
  res.json(result);
}));

router.get('/logs', asyncHandler(async (_req: Request, res: Response) => {
  const result = await prescriptionService.getAllStatusLogs();
  res.json(result);
}));

export default router;
