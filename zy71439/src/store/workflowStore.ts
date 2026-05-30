import { create } from 'zustand';
import { WorkflowStatus, OperationType, User, WorkflowStoreState } from '../types';
import { useRecordStore } from './recordStore';

const INSTRUCTOR_PASSWORD = 'instructor123';

export const useWorkflowStore = create<WorkflowStoreState>()(
  (set, get) => ({
    currentUser: null,

    loginAsInstructor: () => {
      set({
        currentUser: {
          id: 'instructor-001',
          name: '张教员',
          role: 'instructor'
        }
      });
    },

    loginAsTrainee: (name: string) => {
      set({
        currentUser: {
          id: `trainee-${Date.now()}`,
          name,
          role: 'trainee'
        }
      });
    },

    logout: () => set({ currentUser: null })
  })
);

export function approveRecord(recordId: string, comment: string, reviewerName: string) {
  const record = useRecordStore.getState().getRecord(recordId);
  if (!record) return;

  useRecordStore.getState().updateRecord(recordId, {
    workflow: {
      ...record.workflow,
      status: WorkflowStatus.APPROVED,
      reviewerId: 'instructor',
      reviewComment: comment,
      reviewTime: new Date()
    }
  });

  useRecordStore.getState().addOperation(recordId, {
    actionType: OperationType.REVIEW_APPROVE,
    actionDetail: `复核通过：${comment}`,
    operator: reviewerName
  });
}

export function returnRecord(recordId: string, reason: string, reviewerName: string) {
  const record = useRecordStore.getState().getRecord(recordId);
  if (!record) return;

  useRecordStore.getState().updateRecord(recordId, {
    workflow: {
      ...record.workflow,
      status: WorkflowStatus.RETURNED,
      reviewerId: 'instructor',
      reviewComment: reason,
      reviewTime: new Date(),
      returnReason: reason
    }
  });

  useRecordStore.getState().addOperation(recordId, {
    actionType: OperationType.REVIEW_RETURN,
    actionDetail: `退回补材料：${reason}`,
    operator: reviewerName
  });
}

export function getStatusCounts(): Record<WorkflowStatus, number> {
  const records = useRecordStore.getState().records;
  return records.reduce(
    (acc, record) => {
      acc[record.workflow.status]++;
      return acc;
    },
    {
      [WorkflowStatus.PENDING]: 0,
      [WorkflowStatus.APPROVED]: 0,
      [WorkflowStatus.RETURNED]: 0
    }
  );
}

export function validateInstructorPassword(password: string): boolean {
  return password === INSTRUCTOR_PASSWORD;
}
