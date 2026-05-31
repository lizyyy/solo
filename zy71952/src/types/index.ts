export type RecordStatus = 'confirmed' | 'pending' | 'modified';

export type DataSource = 'weather' | 'pilot' | 'photo';

export type ChangeType = 'create' | 'supplement' | 'modify';

export type AnomalyType = 
  | 'missing_return_point' 
  | 'delayed_note' 
  | 'modified_photo' 
  | 'weather_mismatch';

export type Severity = 'low' | 'medium' | 'high';

export interface WeatherData {
  id: string;
  uploadTime: string;
  screenshotUrl: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainfall: number;
  isSupplement: boolean;
}

export interface PilotNote {
  id: string;
  pilotName: string;
  noteTime: string;
  flightStartTime: string;
  flightEndTime: string;
  content: string;
  isSupplement: boolean;
  delayHours?: number;
}

export interface PhotoData {
  id: string;
  uploadTime: string;
  photoUrl: string;
  locationTag: string;
  pestType?: string;
  severity?: Severity;
  isManuallyModified: boolean;
  modifiedBy?: string;
  modifiedTime?: string;
  modifyReason?: string;
}

export interface ChangeLog {
  id: string;
  timestamp: string;
  operator: string;
  changeType: ChangeType;
  field: string;
  oldValue?: string;
  newValue: string;
  description: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: 'warning' | 'error';
  description: string;
  handlingRule: string;
}

export interface FlightRecord {
  id: string;
  flightNo: string;
  flightDate: string;
  location: string;
  status: RecordStatus;
  hasReturnPoint: boolean;
  weatherData: WeatherData;
  pilotNote: PilotNote;
  photos: PhotoData[];
  changeLogs: ChangeLog[];
  anomalies: Anomaly[];
}

export interface ReviewReport {
  generatedAt: string;
  totalRecords: number;
  confirmedCount: number;
  pendingCount: number;
  modifiedCount: number;
  records: {
    confirmed: FlightRecord[];
    pending: FlightRecord[];
    modified: FlightRecord[];
  };
  handlingSummary: string;
  reviewedBy: string;
}

export interface StatusFilter {
  type: 'all' | RecordStatus;
  label: string;
  count: number;
}
