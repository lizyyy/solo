export interface Teacher {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  hourly_rate: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  name: string;
  phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  gender?: 'male' | 'female';
  birth_date?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  teacher_id: string;
  dance_style?: string;
  capacity: number;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface PackageTemplate {
  id: string;
  name: string;
  total_lessons: number;
  price: number;
  valid_days: number;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface StudentPackage {
  id: string;
  student_id: string;
  template_id?: string;
  name: string;
  total_lessons: number;
  used_lessons: number;
  freeze_lessons: number;
  valid_from: string;
  valid_to: string;
  status: 'active' | 'expired' | 'cancelled';
  is_frozen: number;
  frozen_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  class_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  location?: string;
  capacity: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LessonBooking {
  id: string;
  lesson_id: string;
  student_id: string;
  student_package_id?: string;
  status: 'booked' | 'checked_in' | 'absent' | 'cancelled';
  check_in_time?: string;
  is_makeup: number;
  makeup_ticket_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  lesson_booking_id: string;
  student_id: string;
  lesson_id: string;
  leave_type: 'student' | 'teacher';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface MakeupTicket {
  id: string;
  student_id: string;
  leave_id: string;
  original_lesson_id: string;
  used_lesson_id?: string;
  valid_from: string;
  valid_to: string;
  status: 'available' | 'used' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface Waitlist {
  id: string;
  lesson_id: string;
  student_id: string;
  position: number;
  status: 'waiting' | 'converted' | 'cancelled';
  converted_booking_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  title: string;
  content?: string;
  type: 'info' | 'warning' | 'success' | 'error';
  target_type?: string;
  target_id?: string;
  is_read: number;
  read_at?: string;
  created_at: string;
}

export interface TeacherPayment {
  id: string;
  teacher_id: string;
  lesson_id: string;
  amount: number;
  payment_date?: string;
  status: 'pending' | 'paid';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PackageUsageLog {
  id: string;
  student_package_id: string;
  lesson_booking_id?: string;
  action: 'deduct' | 'refund' | 'freeze' | 'unfreeze' | 'adjust';
  change_amount: number;
  balance_before: number;
  balance_after: number;
  reason?: string;
  created_at: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export type BookingStatus = 'booked' | 'checked_in' | 'absent' | 'cancelled';
export type AttendanceStatus = 'booked' | 'checked_in' | 'absent' | 'cancelled';
