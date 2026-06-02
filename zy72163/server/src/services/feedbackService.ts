import db from '../database';
import type { ResidentFeedback } from '../types';

export function createFeedback(data: {
  locationId: number;
  feedbackNo?: string;
  reporter?: string;
  phone?: string;
  feedbackDate: string;
  content: string;
  rawContent: string;
  source: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
}): ResidentFeedback {
  const result = db.resident_feedbacks.insert({
    locationId: data.locationId,
    feedbackNo: data.feedbackNo || null,
    reporter: data.reporter || null,
    phone: data.phone || null,
    feedbackDate: data.feedbackDate,
    content: data.content,
    rawContent: data.rawContent,
    source: data.source,
    status: data.status || 'pending',
    priority: data.priority || 'medium',
    assignedTo: data.assignedTo || null
  });

  return db.resident_feedbacks.get(result.lastInsertRowid) as ResidentFeedback;
}

export function getFeedbackById(id: number): ResidentFeedback | undefined {
  return db.resident_feedbacks.get(id) as ResidentFeedback | undefined;
}

export function getFeedbacksByLocation(locationId: number): ResidentFeedback[] {
  return db.resident_feedbacks.filter((f: any) => f.locationId === locationId).sort((a: any, b: any) => {
    const dateA = new Date(a.feedbackDate || a.createdAt).getTime();
    const dateB = new Date(b.feedbackDate || b.createdAt).getTime();
    return dateB - dateA;
  }) as ResidentFeedback[];
}

export function getAllFeedbacks(filters?: {
  status?: string;
  priority?: string;
  locationId?: number;
}): ResidentFeedback[] {
  let results = db.resident_feedbacks.all();

  if (filters?.status) {
    results = results.filter((f: any) => f.status === filters.status);
  }
  if (filters?.priority) {
    results = results.filter((f: any) => f.priority === filters.priority);
  }
  if (filters?.locationId) {
    results = results.filter((f: any) => f.locationId === filters.locationId);
  }

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  results.sort((a: any, b: any) => {
    const pa = priorityOrder[a.priority] ?? 3;
    const pb = priorityOrder[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.feedbackDate || b.createdAt).getTime() - new Date(a.feedbackDate || a.createdAt).getTime();
  });

  return results as ResidentFeedback[];
}

export function updateFeedback(id: number, updates: Partial<ResidentFeedback>): ResidentFeedback | undefined {
  const { id: _, createdAt: __, locationId: ___, ...data } = updates as any;
  db.resident_feedbacks.update(id, data);
  return getFeedbackById(id);
}

export function deleteFeedback(id: number): boolean {
  const result = db.resident_feedbacks.delete(id);
  return result.changes > 0;
}

export function bulkImportFeedbacks(feedbacks: any[], findLocation: (name: string, lat: number, lng: number, address?: string, street?: string, district?: string) => any): {
  imported: number;
  skipped: number;
  errors: string[];
} {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const fb of feedbacks) {
    try {
      if (!fb.locationName && !fb.lat) {
        skipped++;
        errors.push(`反馈缺少位置信息: ${fb.content?.substring(0, 30)}...`);
        continue;
      }

      const lat = fb.lat || 31.2304 + Math.random() * 0.1;
      const lng = fb.lng || 121.4737 + Math.random() * 0.1;
      
      const { location } = findLocation(
        fb.locationName || fb.address || '未知位置',
        lat,
        lng,
        fb.address,
        fb.street,
        fb.district
      );

      createFeedback({
        locationId: location.id,
        feedbackNo: fb.feedbackNo,
        reporter: fb.reporter,
        phone: fb.phone,
        feedbackDate: fb.feedbackDate || fb.date || new Date().toISOString().split('T')[0],
        content: fb.content || fb.rawContent || '',
        rawContent: fb.rawContent || fb.content || '',
        source: fb.source || '居民反馈',
        status: fb.status,
        priority: fb.priority,
        assignedTo: fb.assignedTo
      });

      imported++;
    } catch (e: any) {
      skipped++;
      errors.push(`导入失败: ${e.message}`);
    }
  }

  return { imported, skipped, errors };
}
