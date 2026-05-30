export interface Student {
  id: number;
  name: string;
  enroll_date: string;
  status: "active" | "archived";
  note: string;
  total_stars: number;
}

export interface Checkin {
  id: number;
  student_id: number;
  date: string;
  duration_minutes: number;
  parent_note: string;
  is_abnormal: boolean;
  confirmed: boolean;
  stars_earned: number;
}

export interface Leave {
  id: number;
  student_id: number;
  date: string;
  reason: string;
  stars_deducted: number;
  has_makeup: boolean;
}

export interface RewardSummary {
  student_id: number;
  student_name: string;
  total_stars: number;
  rank: number;
}

export interface Makeup {
  id: number;
  leave_id: number;
  student_id: number;
  makeup_date: string;
  duration_minutes: number;
  stars_returned: number;
}

export interface StarTransaction {
  id: number;
  student_id: number;
  amount: number;
  type: "checkin_earn" | "leave_deduct" | "makeup_return" | "manual_adjust";
  reference_id: number;
  reference_type: "checkin" | "leave" | "makeup" | "manual";
  note: string;
  created_at: string;
}

export interface RewardRule {
  id: number;
  rule_key: string;
  rule_value: number;
  description: string;
}

export type TransactionType = StarTransaction["type"];
