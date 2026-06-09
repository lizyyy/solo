import { store } from '../data/store.js';
import type { ReplaceAction, ReplaceActionStatus } from '../../shared/types.js';

export interface ReplaceActionFilter {
  batchId?: string;
  overrideId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function getReplaceActions(
  filter: ReplaceActionFilter = {},
): PaginatedResult<ReplaceAction> {
  let result = [...store.replaceActions];

  if (filter.batchId) {
    result = result.filter((a) => a.batchId === filter.batchId);
  }
  if (filter.overrideId) {
    result = result.filter((a) => a.overrideId === filter.overrideId);
  }

  const total = result.length;
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = result.slice(start, end);

  return {
    data,
    total,
    page,
    pageSize,
  };
}

export interface UpdateActionPatch {
  status?: ReplaceActionStatus;
  assignee?: string;
  blockingNote?: string;
}

export function updateAction(
  id: string,
  patch: UpdateActionPatch,
): ReplaceAction | null {
  const action = store.replaceActions.find((a) => a.id === id);
  if (!action) return null;

  if (patch.status !== undefined) {
    action.status = patch.status;
  }
  if (patch.assignee !== undefined) {
    action.assignee = patch.assignee;
  }
  if (patch.blockingNote !== undefined) {
    action.blockingNote = patch.blockingNote;
  }

  return action;
}
