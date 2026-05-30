import { create } from 'zustand';
import type { UserState, UserRole, Student, Teacher } from '@/types/music';
import { SAMPLE_TEACHER, SAMPLE_CLASS } from '@/data/sample';

interface UserStore extends UserState {
  loginAsStudent: (name: string, classCode: string) => boolean;
  loginAsTeacher: (email: string, password: string) => boolean;
  logout: () => void;
  setClassId: (classId: string | null) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  role: null,
  student: null,
  teacher: null,
  classId: null,

  loginAsStudent: (name: string, classCode: string) => {
    if (classCode.toUpperCase() === SAMPLE_CLASS.joinCode) {
      const student: Student = {
        id: `student-${Date.now()}`,
        name,
        classId: SAMPLE_CLASS.id,
      };
      set({
        role: 'student',
        student,
        classId: SAMPLE_CLASS.id,
      });
      localStorage.setItem('jazz_user', JSON.stringify({ role: 'student', student, classId: SAMPLE_CLASS.id }));
      return true;
    }
    return false;
  },

  loginAsTeacher: (email: string, password: string) => {
    if (email && password) {
      set({
        role: 'teacher',
        teacher: SAMPLE_TEACHER,
        classId: SAMPLE_CLASS.id,
      });
      localStorage.setItem('jazz_user', JSON.stringify({ role: 'teacher', teacher: SAMPLE_TEACHER, classId: SAMPLE_CLASS.id }));
      return true;
    }
    return false;
  },

  logout: () => {
    set({
      role: null,
      student: null,
      teacher: null,
      classId: null,
    });
    localStorage.removeItem('jazz_user');
  },

  setClassId: (classId: string | null) => {
    set({ classId });
  },
}));

export function initializeUserFromStorage(): void {
  const stored = localStorage.getItem('jazz_user');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      useUserStore.setState({
        role: data.role as UserRole,
        student: data.student || null,
        teacher: data.teacher || null,
        classId: data.classId || null,
      });
    } catch (e) {
      console.error('Failed to restore user session:', e);
    }
  }
}
