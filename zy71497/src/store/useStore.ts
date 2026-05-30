import { create } from "zustand";
import type { Student, Checkin, Leave, StarTransaction, RewardRule } from "../../shared/types";
import { api } from "../api/client";

interface AppState {
  students: Student[];
  checkins: Checkin[];
  leaves: Leave[];
  transactions: StarTransaction[];
  rewardRules: RewardRule[];
  selectedDate: string;
  loading: boolean;

  fetchStudents: () => Promise<void>;
  fetchCheckins: (date: string) => Promise<void>;
  fetchLeaves: (options?: { student_id?: number; month?: string }) => Promise<void>;
  fetchTransactions: (options?: { student_id?: number; type?: string; from?: string; to?: string }) => Promise<void>;
  fetchRewardRules: () => Promise<void>;
  setSelectedDate: (date: string) => void;

  addStudent: (data: { name: string; enroll_date: string; note?: string }) => Promise<Student>;
  updateStudent: (id: number, data: Partial<Student>) => Promise<Student>;
}

const today = new Date().toISOString().split("T")[0];

export const useStore = create<AppState>((set, get) => ({
  students: [],
  checkins: [],
  leaves: [],
  transactions: [],
  rewardRules: [],
  selectedDate: today,
  loading: false,

  fetchStudents: async () => {
    set({ loading: true });
    const students = await api.students.getAll();
    set({ students, loading: false });
  },

  fetchCheckins: async (date: string) => {
    set({ loading: true });
    const checkins = await api.checkins.getByDate(date);
    set({ checkins, loading: false });
  },

  fetchLeaves: async (options) => {
    set({ loading: true });
    const leaves = await api.leaves.getAll(options);
    set({ leaves, loading: false });
  },

  fetchTransactions: async (options) => {
    set({ loading: true });
    const result = await api.rewards.getTransactions(options);
    set({ transactions: result.transactions, loading: false });
  },

  fetchRewardRules: async () => {
    set({ loading: true });
    const rules = await api.rewards.getRules();
    set({ rewardRules: rules, loading: false });
  },

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
  },

  addStudent: async (data) => {
    const student = await api.students.create(data);
    set((state) => ({ students: [student, ...state.students] }));
    return student;
  },

  updateStudent: async (id: number, data: Partial<Student>) => {
    const student = await api.students.update(id, data);
    set((state) => ({
      students: state.students.map((s) => (s.id === id ? student : s)),
    }));
    return student;
  },
}));
