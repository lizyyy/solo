import { Request, Response } from 'express';
import { WeightService } from '../services/weight.service';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

export class WeightController {
  private weightService = new WeightService();

  submitWeight = asyncHandler(async (req: Request, res: Response) => {
    const {
      requestId,
      orderId,
      orderItemId,
      actualWeight,
      operatorId,
      operatorName,
      deviceId,
      batchNo
    } = req.body;

    const weightRecord = this.weightService.submitWeight({
      requestId,
      orderId,
      orderItemId,
      actualWeight: Number(actualWeight),
      operatorId,
      operatorName,
      deviceId,
      batchNo
    });

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Weight submitted successfully',
      data: weightRecord
    } as ApiResponse);
  });

  replaceItemWithWeight = asyncHandler(async (req: Request, res: Response) => {
    const {
      requestId,
      orderId,
      orderItemId,
      newProductId,
      actualWeight,
      operatorId,
      operatorName,
      deviceId,
      batchNo
    } = req.body;

    const weightRecord = this.weightService.replaceItemWithWeight({
      requestId,
      orderId,
      orderItemId,
      newProductId,
      actualWeight: Number(actualWeight),
      operatorId,
      operatorName,
      deviceId,
      batchNo
    });

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Item replaced with weight submitted successfully',
      data: weightRecord
    } as ApiResponse);
  });

  getWeightRecord = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const weightRecord = this.weightService.getWeightRecord(id);

    if (!weightRecord) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Weight record not found'
      } as ApiResponse);
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Weight record retrieved successfully',
      data: weightRecord
    } as ApiResponse);
  });

  getWeightRecordsByOrder = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const records = this.weightService.getWeightRecordsByOrder(orderId);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Weight records retrieved successfully',
      data: {
        records,
        total: records.length
      }
    } as ApiResponse);
  });

  getWeightHistory = asyncHandler(async (req: Request, res: Response) => {
    const { orderItemId } = req.params;
    const history = this.weightService.getWeightHistory(orderItemId);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Weight history retrieved successfully',
      data: {
        history,
        total: history.length
      }
    } as ApiResponse);
  });
}
