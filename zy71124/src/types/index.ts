export interface Bus {
  id: string;
  number: string;
  route: string;
  capacity: number;
  currentStudents: number;
  parkingSpotId: string | null;
  departureTime: number;
  status: 'parked' | 'boarding' | 'departing' | 'departed';
  color: string;
  row: number;
  col: number;
  exitLane: number;
}

export interface ParkingSpot {
  id: string;
  position: { x: number; z: number };
  size: { width: number; length: number };
  occupiedBy: string | null;
  row: number;
  col: number;
  isExitPath: boolean;
}

export interface StudentQueue {
  id: string;
  busId: string;
  position: { x: number; z: number };
  totalStudents: number;
  currentIndex: number;
  boardingRate: number;
}

export interface Conflict {
  id: string;
  type: 'spot_blocked' | 'departure_conflict' | 'lane_occupied';
  time: number;
  severity: 'warning' | 'critical';
  involvedBuses: string[];
  description: string;
  resolved: boolean;
}

export interface ScheduleState {
  buses: Bus[];
  parkingSpots: ParkingSpot[];
  queues: StudentQueue[];
  conflicts: Conflict[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  playSpeed: number;
  viewMode: '3d' | '2d';
  cameraView: 'default' | 'top' | 'front' | 'side';
  selectedBusId: string | null;
  showReport: boolean;
  filterStatus: 'all' | 'parked' | 'boarding' | 'departing' | 'departed';
  searchQuery: string;
}

export interface SampleData {
  name: string;
  description: string;
  buses: Bus[];
  parkingSpots: ParkingSpot[];
  queues: StudentQueue[];
}
