import type { OrderStatus } from '../types';

export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  '待检测': ['待报价', '已取消'],
  '待报价': ['维修中', '待取机', '已取消'],
  '维修中': ['待取机', '已取消'],
  '待取机': ['已完成', '已取消'],
  '已完成': [],
  '已取消': []
};

export const STATUS_LABELS: OrderStatus[] = [
  '待检测',
  '待报价',
  '维修中',
  '待取机',
  '已完成',
  '已取消'
];

export const STATUS_COLORS: Record<OrderStatus, string> = {
  '待检测': 'yellow',
  '待报价': 'orange',
  '维修中': 'blue',
  '待取机': 'green',
  '已完成': 'gray',
  '已取消': 'red'
};
