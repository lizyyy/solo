export interface Artwork {
  id: string;
  title: string;
  artist: string;
  dimensions: string;
  dimension_unit: string;
  medium: string;
  year: string;
  status: 'unchecked' | 'checked' | 'disputed' | 'corrected';
  created_at: string;
  updated_at: string;
}

export interface SourceLink {
  id: string;
  artwork_id: string;
  source_type: 'insurance' | 'lighting' | 'artwork_list';
  source_title: string;
  source_summary: string;
  source_data: Record<string, unknown>;
  imported_at: string;
}

export interface Correction {
  id: string;
  artwork_id: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
  reverted: boolean;
  revert_reason?: string;
  created_at: string;
  reverted_at?: string;
}

export interface Dispute {
  id: string;
  artwork_id: string;
  field: string;
  current_value: string;
  dispute_reason: string;
  correction_basis: string;
  source_reference?: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface ArtworkDetail extends Artwork {
  sources: SourceLink[];
  corrections: Correction[];
  disputes: Dispute[];
}

export interface Stats {
  total: number;
  unchecked: number;
  checked: number;
  disputed: number;
  corrected: number;
}

export interface DuplicateEntry {
  id: string;
  existing_id: string;
  existing_title: string;
  incoming_title: string;
  match_fields: string[];
}

export interface ImportResponse {
  imported: number;
  duplicates: DuplicateEntry[];
  errors: string[];
}
