import { Appointment, ConflictResult, LARGE_INDEX_THRESHOLD, LOW_PEAK_WINDOWS, AppointmentStatus } from '../types';
import { store } from '../store';

export class ConflictService {
  checkConflict(newAppointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>, excludeId?: string): ConflictResult {
    const isNewLargeIndex = newAppointment.dataSize >= LARGE_INDEX_THRESHOLD;
    const isLowPeakWindow = this.isLowPeakWindow(newAppointment.timeWindow.start, newAppointment.timeWindow.end);

    if (!isNewLargeIndex || !isLowPeakWindow) {
      return { hasConflict: false, message: '无冲突' };
    }

    const existingLargeIndices = store.getAllAppointments().filter(a => {
      if (excludeId && a.id === excludeId) return false;
      const isLarge = a.dataSize >= LARGE_INDEX_THRESHOLD;
      const isSameWindow = this.isTimeOverlap(
        a.timeWindow.start, a.timeWindow.end,
        newAppointment.timeWindow.start, newAppointment.timeWindow.end
      );
      const isActiveStatus = [
        AppointmentStatus.PENDING_CONFIRM,
        AppointmentStatus.LOCKED,
        AppointmentStatus.REBUILDING
      ].includes(a.status);
      
      return isLarge && isSameWindow && isActiveStatus;
    });

    if (existingLargeIndices.length > 0) {
      return {
        hasConflict: true,
        conflictAppointments: existingLargeIndices,
        message: `检测到冲突：已有 ${existingLargeIndices.length} 个大索引占用该低峰窗口。冲突索引：${existingLargeIndices.map(a => a.indexName).join(', ')}`
      };
    }

    return { hasConflict: false, message: '无冲突' };
  }

  private isLowPeakWindow(start: string, end: string): boolean {
    return LOW_PEAK_WINDOWS.some(window => 
      this.isTimeOverlap(window.start, window.end, start, end)
    );
  }

  private isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
  }
}

export const conflictService = new ConflictService();
