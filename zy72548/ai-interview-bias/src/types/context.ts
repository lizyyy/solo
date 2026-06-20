import type { AppState, ReviewRecord, Role, PromptVersion } from './index';

export type Action =
  | { type: 'SET_ROLE'; payload: { role: Role; user: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: AppState['activeTab'] }
  | { type: 'SELECT_RECORD'; payload: string | undefined }
  | { type: 'ADD_REVIEW_RECORDS'; payload: ReviewRecord[] }
  | { type: 'UPDATE_REVIEW_RECORD'; payload: ReviewRecord }
  | { type: 'ADD_PROMPT_VERSION'; payload: PromptVersion }
  | { type: 'APPLY_PROMPT_VERSION'; payload: { recordId: string; promptVersion: PromptVersion } }
  | { type: 'RESOLVE_CONFLICT'; payload: { recordId: string; conflictId: string; resolution: 'confirm' | 'reject' | 'operation_review'; operator: string } }
  | { type: 'PM_CONFIRM'; payload: { recordId: string; operator: string } }
  | { type: 'PM_REJECT'; payload: { recordId: string; operator: string; reason: string } }
  | { type: 'OPERATION_APPROVE'; payload: { recordId: string; operator: string } }
  | { type: 'OPERATION_REJECT'; payload: { recordId: string; operator: string; reason: string } }
  | { type: 'FINALIZE_RECORD'; payload: { recordId: string; operator: string } }
  | { type: 'RESET_STATE' };
