const API_BASE = '/api';

export interface Statistics {
  lost_items: {
    total: number;
    pending: number;
    matched: number;
    resolved: number;
  };
  found_items: {
    total: number;
    pending: number;
    matched: number;
    resolved: number;
  };
  matches: {
    total: number;
    candidate: number;
    pending_review: number;
    confirmed: number;
    rejected: number;
    avg_score: number;
  };
  current_pipeline: PipelineStatus | null;
}

export interface PipelineStatus {
  id: string;
  pipeline_name: string;
  status: string;
  current_stage: string;
  processed_count: number;
  total_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface MatchItem {
  id: string;
  lost_id: string;
  found_id: string;
  match_score: number;
  match_stage: string;
  status: string;
  confidence: string;
  lost_description: string;
  found_description: string;
  lost_category: string | null;
  found_category: string | null;
  lost_line: string | null;
  lost_station: string | null;
  found_line: string | null;
  found_station: string | null;
  lost_date: string | null;
  found_date: string | null;
}

export interface ChangeLog {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  operator: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  match_id: string;
  feedback_type: string;
  feedback_note: string;
  operator: string;
  created_at: string;
}

export interface MatchDetail {
  match: MatchItem;
  feedback: Feedback[];
  changes: ChangeLog[];
}

export const api = {
  async getStats(): Promise<Statistics> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getPipelineStatus() {
    const res = await fetch(`${API_BASE}/pipeline/status`);
    if (!res.ok) throw new Error('Failed to fetch pipeline status');
    return res.json();
  },

  async runPipeline(lostItems: any[], foundItems: any[]) {
    const res = await fetch(`${API_BASE}/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lost_items: lostItems,
        found_items: foundItems
      })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to run pipeline');
    }
    return res.json();
  },

  async getPendingMatches(limit = 100): Promise<MatchItem[]> {
    const res = await fetch(`${API_BASE}/matches/pending?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch matches');
    return res.json();
  },

  async getMatchDetail(id: string): Promise<MatchDetail> {
    const res = await fetch(`${API_BASE}/matches/${id}`);
    if (!res.ok) throw new Error('Failed to fetch match detail');
    return res.json();
  },

  async submitFeedback(matchId: string, feedbackType: string, feedbackNote: string, operator: string) {
    const res = await fetch(`${API_BASE}/matches/${matchId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedback_type: feedbackType,
        feedback_note: feedbackNote,
        operator: operator
      })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to submit feedback');
    }
    return res.json();
  },

  async getChangeLogs(limit = 50): Promise<ChangeLog[]> {
    const res = await fetch(`${API_BASE}/changelog?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch changelog');
    return res.json();
  }
};
