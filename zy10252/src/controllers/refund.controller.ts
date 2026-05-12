import { Request, Response } from 'express';
import { RefundService } from '../services/refund.service';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, RefundReason } from '../types';

export class RefundController {
  private refundService = new RefundService();

  createRefund = asyncHandler(async (req: Request, res: Response) => {
    const {
      orderId,
      orderItemId,
      reason,
      reasonDetail,
      amount,
      operatorId,
      operatorName
    } = req.body;

    if (!orderId || !reason || !reasonDetail || !amount || !operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields'
      } as ApiResponse);
    }

    const refund = this.refundService.createRefund({
      orderId,
      orderItemId,
      reason,
      reasonDetail,
      amount: Number(amount),
      operatorId,
      operatorName
    });

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Refund created successfully',
      data: refund
    } as ApiResponse);
  });

  createWeightDifferenceRefund = asyncHandler(async (req: Request, res: Response) => {
    const { orderId, orderItemId, operatorId, operatorName } = req.body;

    if (!orderId || !orderItemId || !operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields'
      } as ApiResponse);
    }

    const refund = this.refundService.createWeightDifferenceRefund({
      orderId,
      orderItemId,
      operatorId,
      operatorName
    });

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Weight difference refund created successfully',
      data: refund
    } as ApiResponse);
  });

  approveRefund = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const refund = this.refundService.approveRefund(id);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Refund approved successfully',
      data: refund
    } as ApiResponse);
  });

  rejectRefund = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Rejection reason is required'
      } as ApiResponse);
    }

    const refund = this.refundService.rejectRefund(id, reason);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Refund rejected successfully',
      data: refund
    } as ApiResponse);
  });

  processRefund = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const refund = this.refundService.processRefund(id);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Refund processed successfully',
      data: refund
    } as ApiResponse);
  });

  getRefundRecord = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const refund = this.refundService.getRefundRecord(id);

    if (!refund) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Refund record not found'
      } as ApiResponse);
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Refund record retrieved successfully',
      data: refund
    } as ApiResponse);
  });

  getRefundRecordsByOrder = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const records = this.refundService.getRefundRecordsByOrder(orderId);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Refund records retrieved successfully',
      data: {
        records,
        total: records.length
      }
    } as ApiResponse);
  });
}
