import prisma from '../utils/prisma';
import { OrderStatus } from '../types';
import { BusinessError } from '../utils/response';
import dayjs from 'dayjs';

export interface CreateOrderDTO {
  merchantNo: string;
  merchantOrderNo?: string;
  amount: number;
  serviceFee?: number;
  platformFee?: number;
  payTime: string;
}

export async function createOrder(dto: CreateOrderDTO) {
  const merchant = await prisma.merchant.findUnique({
    where: { merchantNo: dto.merchantNo },
  });
  
  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;

  const orderNo = `O${dayjs(dto.payTime).format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return prisma.order.create({
    data: {
      orderNo,
      merchantId: merchant.id,
      merchantOrderNo: dto.merchantOrderNo,
      amount: dto.amount,
      serviceFee: dto.serviceFee || 0,
      platformFee: dto.platformFee || 0,
      payTime: new Date(dto.payTime),
      status: OrderStatus.COMPLETED,
    },
  });
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      merchant: true,
      refunds: true,
    },
  });
  
  if (!order) throw BusinessError.ORDER_NOT_FOUND;
  return order;
}

export async function getOrderByNo(orderNo: string) {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      merchant: true,
      refunds: true,
    },
  });
  
  if (!order) throw BusinessError.ORDER_NOT_FOUND;
  return order;
}

export async function listOrders(
  merchantNo?: string,
  startDate?: string,
  endDate?: string,
  status?: OrderStatus,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;
  
  const where: any = {};
  
  if (merchantNo) {
    const merchant = await prisma.merchant.findUnique({
      where: { merchantNo },
    });
    if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;
    where.merchantId = merchant.id;
  }
  
  if (startDate || endDate) {
    where.payTime = {};
    if (startDate) where.payTime.gte = new Date(startDate);
    if (endDate) where.payTime.lte = new Date(endDate);
  }
  
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { payTime: 'desc' },
      include: {
        merchant: {
          select: { merchantNo: true, name: true },
        },
        refunds: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getUnsettledOrders(
  merchantId: string,
  startDate: Date,
  endDate: Date
) {
  const settlementItems = await prisma.settlementItem.findMany({
    where: {
      merchantId,
      itemType: 'ORDER',
    },
    select: { itemNo: true },
  });

  const settledOrderNos = settlementItems.map(item => item.itemNo);

  return prisma.order.findMany({
    where: {
      merchantId,
      payTime: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: [OrderStatus.COMPLETED, OrderStatus.PARTIAL_REFUNDED],
      },
      NOT: {
        orderNo: {
          in: settledOrderNos,
        },
      },
    },
    orderBy: { payTime: 'asc' },
  });
}
