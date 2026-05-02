import type { ObjectType, ColorRGB, Vector3D } from './types';

export interface ObjectTemplate {
  type: ObjectType;
  name: string;
  defaultDimensions: Vector3D;
  defaultColor: ColorRGB;
  category: string;
  icon: string;
  description: string;
}

export const OBJECT_CATEGORIES = [
  { id: 'furniture', name: '家具', icon: '🪑' },
  { id: 'display', name: '展示', icon: '🖼️' },
  { id: 'infrastructure', name: '基础设施', icon: '🔌' },
  { id: 'markers', name: '标记', icon: '🚪' },
  { id: 'zones', name: '区域', icon: '📐' },
];

export const OBJECT_TEMPLATES: ObjectTemplate[] = [
  {
    type: 'table',
    name: '长条桌',
    defaultDimensions: { x: 1.8, y: 0.75, z: 0.6 },
    defaultColor: { r: 139, g: 90, b: 43 },
    category: 'furniture',
    icon: '🪑',
    description: '标准长条桌，可用于商品展示或接待',
  },
  {
    type: 'table',
    name: '方桌',
    defaultDimensions: { x: 0.8, y: 0.75, z: 0.8 },
    defaultColor: { r: 139, g: 90, b: 43 },
    category: 'furniture',
    icon: '🛋️',
    description: '方形桌子，适合角落或独立展示',
  },
  {
    type: 'table',
    name: '圆形展台',
    defaultDimensions: { x: 1.0, y: 0.8, z: 1.0 },
    defaultColor: { r: 180, g: 180, b: 180 },
    category: 'furniture',
    icon: '⭕',
    description: '圆形展台，适合重点产品展示',
  },
  {
    type: 'display_rack',
    name: '层架展架',
    defaultDimensions: { x: 1.5, y: 1.8, z: 0.4 },
    defaultColor: { r: 200, g: 200, b: 200 },
    category: 'display',
    icon: '📚',
    description: '多层展架，可陈列商品或宣传资料',
  },
  {
    type: 'display_rack',
    name: '立式展架',
    defaultDimensions: { x: 0.6, y: 2.0, z: 0.3 },
    defaultColor: { r: 80, g: 80, b: 80 },
    category: 'display',
    icon: '🖼️',
    description: '立式海报架或KT板展架',
  },
  {
    type: 'cashier_desk',
    name: '收银台',
    defaultDimensions: { x: 1.2, y: 0.9, z: 0.6 },
    defaultColor: { r: 60, g: 60, b: 60 },
    category: 'infrastructure',
    icon: '💳',
    description: '收银/接待台，建议放置在靠近出口位置',
  },
  {
    type: 'power_outlet',
    name: '电源插座',
    defaultDimensions: { x: 0.1, y: 0.1, z: 0.1 },
    defaultColor: { r: 255, g: 200, b: 0 },
    category: 'infrastructure',
    icon: '🔌',
    description: '电源插座位置标记',
  },
  {
    type: 'power_cable',
    name: '电源线',
    defaultDimensions: { x: 2.0, y: 0.02, z: 0.05 },
    defaultColor: { r: 50, g: 50, b: 50 },
    category: 'infrastructure',
    icon: '⚡',
    description: '电源线布置（长度可调整）',
  },
  {
    type: 'entrance',
    name: '入口',
    defaultDimensions: { x: 1.5, y: 0.1, z: 0.5 },
    defaultColor: { r: 34, g: 139, b: 34 },
    category: 'markers',
    icon: '🚪',
    description: '摊位入口位置（建议靠近主通道）',
  },
  {
    type: 'exit',
    name: '出口',
    defaultDimensions: { x: 1.5, y: 0.1, z: 0.5 },
    defaultColor: { r: 178, g: 34, b: 34 },
    category: 'markers',
    icon: '🚶',
    description: '摊位出口位置',
  },
  {
    type: 'safety_aisle',
    name: '安全通道',
    defaultDimensions: { x: 2.0, y: 0.05, z: 0.0 },
    defaultColor: { r: 255, g: 165, b: 0 },
    category: 'zones',
    icon: '⚠️',
    description: '必须留空的安全通道区域（不可放置物品）',
  },
  {
    type: 'feature_wall',
    name: '主视觉墙',
    defaultDimensions: { x: 3.0, y: 2.5, z: 0.1 },
    defaultColor: { r: 100, g: 149, b: 237 },
    category: 'display',
    icon: '🏠',
    description: '摊位主视觉墙/背景板（视线检查参照）',
  },
];

export function getTemplateByType(type: ObjectType): ObjectTemplate | undefined {
  return OBJECT_TEMPLATES.find(t => t.type === type);
}

export function getTemplatesByCategory(categoryId: string): ObjectTemplate[] {
  return OBJECT_TEMPLATES.filter(t => t.category === categoryId);
}

export function generateId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
