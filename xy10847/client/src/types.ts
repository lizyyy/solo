export type TaskStatus = 'pending' | 'transcribing' | 'transcribed' | 'callback_pending' | 'callback_failed' | 'completed' | 'failed';

export interface AudioTask {
  id: string;
  audio_url: string;
  audio_duration?: number;
  file_name?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface TranscriptionStage {
  id: string;
  task_id: string;
  stage_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CallbackTarget {
  id: string;
  task_id: string;
  target_url: string;
  secret_key?: string;
  retry_count: number;
  max_retries: number;
  last_callback_at?: string;
  next_retry_at?: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  created_at: string;
}

export interface TextFragment {
  id: string;
  task_id: string;
  speaker?: string;
  start_time: number;
  end_time: number;
  content: string;
  confidence?: number;
  created_at: string;
}

export interface FailureRecord {
  id: string;
  task_id: string;
  target_id?: string;
  stage: string;
  error_code?: string;
  error_message?: string;
  request_payload?: string;
  response_data?: string;
  responsibility_node?: string;
  created_at: string;
}

export interface RetryRecord {
  id: string;
  task_id: string;
  target_id: string;
  retry_number: number;
  request_payload?: string;
  response_data?: string;
  status: 'success' | 'failed' | 'processing';
  created_at: string;
}

export interface StatusHistory {
  id: string;
  task_id: string;
  from_status?: string;
  to_status: string;
  operator?: string;
  remark?: string;
  created_at: string;
}

export interface TaskDetail extends AudioTask {
  stages: TranscriptionStage[];
  callback_target: CallbackTarget;
  fragments: TextFragment[];
  failures: FailureRecord[];
  retries: RetryRecord[];
  history: StatusHistory[];
}

export interface CreateTaskRequest {
  audio_url: string;
  audio_duration?: number;
  file_name?: string;
  callback_url: string;
  secret_key?: string;
}
