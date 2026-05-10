export interface Consultant {
  id: number;
  name: string;
  department: string;
  created_at: string;
}

export interface Course {
  id: number;
  name: string;
  age_range: string;
  description: string;
  created_at: string;
}

export interface Promotion {
  id: number;
  name: string;
  discount_amount: number;
  expire_date: string;
  max_count: number;
  used_count: number;
  status: string;
  created_at: string;
  is_available: number;
}

export type BookingStatus = 'booked' | 'following' | 'enrolled' | 'no_show' | 'lost';

export interface Booking {
  id: number;
  customer_id: number;
  course_id: number;
  consultant_id: number;
  booking_date: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  child_name: string;
  child_age: number;
  consultant_name: string;
  course_name: string;
  check_in_time: string | null;
}

export interface FollowUp {
  id: number;
  booking_id: number;
  consultant_id: number;
  follow_up_type: string;
  content: string;
  next_follow_up_date: string | null;
  created_at: string;
  consultant_name: string;
}

export interface LostLead {
  id: number;
  booking_id: number;
  lost_reason: string;
  lost_date: string;
  reactivated_at: string | null;
  created_at: string;
}

export interface BookingDetail extends Booking {
  parent_name: string | null;
  phone: string | null;
  department: string;
  age_range: string;
  attendance_notes: string | null;
  satisfaction: number | null;
  feedback_text: string | null;
  enrollment_id: number | null;
  promotion_id: number | null;
  enrollment_date: string | null;
  amount: number | null;
  enrollment_notes: string | null;
  follow_ups: FollowUp[];
  lost_history: LostLead[];
}

export interface ConsultantStats {
  id: number;
  name: string;
  department: string;
  total_bookings: number;
  enrolled_count: number;
  lost_count: number;
  no_show_count: number;
  follow_up_count: number;
  avg_satisfaction: number | null;
}

export interface CourseStats {
  id: number;
  name: string;
  age_range: string;
  total_bookings: number;
  enrolled_count: number;
}

export interface Statistics {
  overview: {
    total_bookings: number;
    enrolled_count: number;
    no_show_count: number;
    lost_count: number;
    following_count: number;
    reactivated_count: number;
    conversion_rate: number;
  };
  consultant_stats: ConsultantStats[];
  course_stats: CourseStats[];
}

export const statusLabels: Record<BookingStatus, string> = {
  booked: '已预约',
  following: '跟进中',
  enrolled: '已报名',
  no_show: '未到课',
  lost: '已流失'
};

export const statusColors: Record<BookingStatus, string> = {
  booked: '#2196f3',
  following: '#ff9800',
  enrolled: '#4caf50',
  no_show: '#f44336',
  lost: '#9e9e9e'
};
