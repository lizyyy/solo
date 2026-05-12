import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, OrderStatus } from '../types';

export class OrderController {
  private orderService = new OrderService();

  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const { orderNo, customerId, customerName, items } = req.body;

    if (!orderNo || !customerId || !customerName || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Missing required fields'
      } as ApiResponse);
    }

    const order = this.orderService.createOrder({
      orderNo,
      customerId,
      customerName,
      items
    });

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Order created successfully',
      data: order
    } as ApiResponse);
  });

  getOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = this.orderService.getOrder(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Order not found'
      } as ApiResponse);
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Order retrieved successfully',
      data: order
    } as ApiResponse);
  });

  getOrderByNo = asyncHandler(async (req: Request, res: Response) => {
    const { orderNo } = req.params;
    const order = this.orderService.getOrderByNo(orderNo);

    if (!order) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Order not found'
      } as ApiResponse);
    }

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Order retrieved successfully',
      data: order
    } as ApiResponse);
  });

  getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = this.orderService.getAllOrders();

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Orders retrieved successfully',
      data: {
        orders,
        total: orders.length
      }
    } as ApiResponse);
  });

  updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Invalid order status'
      } as ApiResponse);
    }

    const order = this.orderService.updateOrderStatus(id, status);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Order status updated successfully',
      data: order
    } as ApiResponse);
  });

  confirmOutbound = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = this.orderService.confirmOutbound(id);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Order outbound confirmed successfully',
      data: order
    } as ApiResponse);
  });

  getWeightDifferenceSummary = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const summary = this.orderService.getWeightDifferenceSummary(orderId);

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Weight difference summary retrieved successfully',
      data: summary
    } as ApiResponse);
  });
}
