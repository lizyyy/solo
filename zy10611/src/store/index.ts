import { Appointment, AppointmentHistory } from '../types';

class DataStore {
  private appointments: Map<string, Appointment> = new Map();
  private histories: Map<string, AppointmentHistory[]> = new Map();

  saveAppointment(appointment: Appointment): void {
    this.appointments.set(appointment.id, appointment);
  }

  getAppointment(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  getAllAppointments(): Appointment[] {
    return Array.from(this.appointments.values());
  }

  deleteAppointment(id: string): boolean {
    return this.appointments.delete(id);
  }

  saveHistory(history: AppointmentHistory): void {
    const existing = this.histories.get(history.appointmentId) || [];
    existing.push(history);
    this.histories.set(history.appointmentId, existing);
  }

  getHistories(appointmentId: string): AppointmentHistory[] {
    return this.histories.get(appointmentId) || [];
  }

  getAppointmentsByStatus(status: string): Appointment[] {
    return this.getAllAppointments().filter(a => a.status === status);
  }

  getAppointmentsByTimeWindow(start: string, end: string): Appointment[] {
    return this.getAllAppointments().filter(a => 
      this.isTimeOverlap(a.timeWindow.start, a.timeWindow.end, start, end)
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

export const store = new DataStore();
