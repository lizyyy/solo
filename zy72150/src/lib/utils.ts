import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PointStatus } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    gis: 'GIS点位',
    resident: '居民反馈',
    inspection: '巡检记录',
    street: '街道备注',
  };
  return labels[source] || source;
}

export function getStatusLabel(status: PointStatus): string {
  const labels: Record<PointStatus, string> = {
    pending: '待核实',
    verified: '已处理',
    onsite: '需要现场复看',
    processed: '已完成',
  };
  return labels[status] || status;
}

export function getStatusColor(status: PointStatus): string {
  const colors: Record<PointStatus, string> = {
    pending: 'bg-orange-100 text-orange-800',
    verified: 'bg-green-100 text-green-800',
    onsite: 'bg-red-100 text-red-800',
    processed: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    gis: 'bg-blue-100 text-blue-800',
    resident: 'bg-purple-100 text-purple-800',
    inspection: 'bg-teal-100 text-teal-800',
    street: 'bg-amber-100 text-amber-800',
  };
  return colors[source] || 'bg-gray-100 text-gray-800';
}
