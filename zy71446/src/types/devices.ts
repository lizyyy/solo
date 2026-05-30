export interface Escalator {
  id: string;
  name: string;
  position: [number, number, number];
  direction: 'up' | 'down' | 'stopped';
  speed: number;
  expectedDirection?: 'up' | 'down';
  hasMaintenanceRecord?: boolean;
}

export interface Turnstile {
  id: string;
  name: string;
  position: [number, number, number];
  status: 'open' | 'closed' | 'fault';
  throughput: number;
  queueLength: number;
}

export interface Platform {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  capacity: number;
  line: string;
}
