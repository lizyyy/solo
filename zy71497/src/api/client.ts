import type {
  Student,
  Checkin,
  Leave,
  Makeup,
  StarTransaction,
  RewardRule,
} from "../../shared/types";

const apiBase = "/api";

export const api = {
  students: {
    getAll: async (): Promise<Student[]> => {
      const res = await fetch(`${apiBase}/students`);
      const data = await res.json();
      return data.students;
    },
    create: async (data: {
      name: string;
      enroll_date: string;
      note?: string;
    }): Promise<Student> => {
      const res = await fetch(`${apiBase}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      return result.student;
    },
    update: async (
      id: number,
      data: Partial<Student>
    ): Promise<Student> => {
      const res = await fetch(`${apiBase}/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      return result.student;
    },
  },

  checkins: {
    getByDate: async (date: string): Promise<Checkin[]> => {
      const res = await fetch(`${apiBase}/checkins?date=${date}`);
      const data = await res.json();
      return data.checkins;
    },
    batchUpsert: async (
      date: string,
      records: {
        student_id: number;
        duration_minutes: number;
        parent_note?: string;
      }[]
    ): Promise<{
      checkins: Checkin[];
      warnings: { student_id: number; reason: string }[];
    }> => {
      const res = await fetch(`${apiBase}/checkins/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records }),
      });
      return res.json();
    },
    confirm: async (
      id: number
    ): Promise<{ checkin: Checkin; starTransaction: StarTransaction }> => {
      const res = await fetch(`${apiBase}/checkins/${id}/confirm`, {
        method: "PUT",
      });
      return res.json();
    },
  },

  leaves: {
    getAll: async (options?: {
      student_id?: number;
      month?: string;
    }): Promise<Leave[]> => {
      const params = new URLSearchParams();
      if (options?.student_id)
        params.set("student_id", options.student_id.toString());
      if (options?.month) params.set("month", options.month);
      const res = await fetch(
        `${apiBase}/leaves?${params.toString()}`
      );
      const data = await res.json();
      return data.leaves;
    },
    create: async (data: {
      student_id: number;
      date: string;
      reason: string;
    }): Promise<{ leave: Leave; starTransaction: StarTransaction }> => {
      const res = await fetch(`${apiBase}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    checkDuplicateMakeup: async (
      leaveId: number
    ): Promise<{ is_duplicate: boolean; existing_makeup: Makeup | null }> => {
      const res = await fetch(
        `${apiBase}/leaves/makeups/check-duplicate?leave_id=${leaveId}`
      );
      return res.json();
    },
    createMakeup: async (data: {
      leave_id: number;
      makeup_date: string;
      duration_minutes: number;
    }): Promise<{ makeup: Makeup; starTransaction: StarTransaction }> => {
      const res = await fetch(`${apiBase}/leaves/makeups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    getMakeups: async (studentId?: number): Promise<Makeup[]> => {
      const params = studentId ? `?student_id=${studentId}` : "";
      const res = await fetch(`${apiBase}/leaves/makeups${params}`);
      const data = await res.json();
      return data.makeups;
    },
  },

  rewards: {
    getRules: async (): Promise<RewardRule[]> => {
      const res = await fetch(`${apiBase}/rewards/rules`);
      const data = await res.json();
      return data.rules;
    },
    updateRules: async (
      rules: { rule_key: string; rule_value: number }[]
    ): Promise<RewardRule[]> => {
      const res = await fetch(`${apiBase}/rewards/rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      return data.rules;
    },
    getTransactions: async (options?: {
      student_id?: number;
      type?: string;
      from?: string;
      to?: string;
    }): Promise<{
      transactions: StarTransaction[];
      total_count: number;
    }> => {
      const params = new URLSearchParams();
      if (options?.student_id)
        params.set("student_id", options.student_id.toString());
      if (options?.type) params.set("type", options.type);
      if (options?.from) params.set("from", options.from);
      if (options?.to) params.set("to", options.to);
      const res = await fetch(
        `${apiBase}/rewards/transactions?${params.toString()}`
      );
      return res.json();
    },
    getSummary: async (): Promise<
      { student_id: number; student_name: string; total_stars: number; rank: number }[]
    > => {
      const res = await fetch(`${apiBase}/rewards/summary`);
      const data = await res.json();
      return data.summary;
    },
  },

  export: {
    exportData: async (data: {
      type: "checkins" | "transactions" | "leaves_makeups";
      from: string;
      to: string;
    }): Promise<{
      download_url: string;
      record_count: number;
      db_total_count: number;
      is_consistent: boolean;
    }> => {
      const res = await fetch(`${apiBase}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
  },
};
