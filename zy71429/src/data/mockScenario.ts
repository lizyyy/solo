import { Ship, Berth, Tug, Weather, DataSource } from '../types/game';

const now = new Date();
const mockImportTime = new Date(now.getTime() - 3600000);

const createMockSource = (file: string, line: number, rawContent: string): DataSource => ({
  file,
  line,
  rawContent,
  importTimestamp: mockImportTime,
});

export const mockShips: Ship[] = [
  {
    id: 'ship-001',
    name: '远洋号',
    length: 320,
    draft: 12.5,
    priority: 'high',
    eta: new Date(now.getTime() + 30 * 60000),
    tugRequired: 12000,
    status: 'waiting',
    source: createMockSource('ships.csv', 2, 'ship-001,远洋号,320,12.5,high,2026-05-30T08:30:00,12000'),
  },
  {
    id: 'ship-002',
    name: '明珠轮',
    length: 280,
    draft: 10.8,
    priority: 'medium',
    eta: new Date(now.getTime() + 60 * 60000),
    tugRequired: 8000,
    status: 'waiting',
    source: createMockSource('ships.csv', 3, 'ship-002,明珠轮,280,10.8,medium,2026-05-30T09:00:00,8000'),
  },
  {
    id: 'ship-003',
    name: '东方之星',
    length: 350,
    draft: 14.2,
    priority: 'high',
    eta: new Date(now.getTime() + 90 * 60000),
    tugRequired: 15000,
    status: 'waiting',
    source: createMockSource('ships.csv', 4, 'ship-003,东方之星,350,14.2,high,2026-05-30T09:30:00,15000'),
  },
  {
    id: 'ship-004',
    name: '海航号',
    length: 220,
    draft: 8.5,
    priority: 'low',
    eta: new Date(now.getTime() + 120 * 60000),
    tugRequired: 6000,
    status: 'waiting',
    source: createMockSource('ships.csv', 5, 'ship-004,海航号,220,8.5,low,2026-05-30T10:00:00,6000'),
  },
  {
    id: 'ship-005',
    name: '蓝鲸号',
    length: 300,
    draft: 11.5,
    priority: 'medium',
    eta: new Date(now.getTime() + 180 * 60000),
    tugRequired: 10000,
    status: 'waiting',
    source: createMockSource('ships.csv', 6, 'ship-005,蓝鲸号,300,11.5,medium,2026-05-30T11:00:00,10000'),
  },
];

export const mockBerths: Berth[] = [
  {
    id: 'berth-001',
    name: '1号泊位',
    maxLength: 350,
    maxDraft: 15,
    status: 'available',
    occupiedUntil: null,
    currentShipId: null,
    source: createMockSource('berths.csv', 2, 'berth-001,1号泊位,350,15,available'),
  },
  {
    id: 'berth-002',
    name: '2号泊位',
    maxLength: 300,
    maxDraft: 12,
    status: 'available',
    occupiedUntil: null,
    currentShipId: null,
    source: createMockSource('berths.csv', 3, 'berth-002,2号泊位,300,12,available'),
  },
  {
    id: 'berth-003',
    name: '3号泊位',
    maxLength: 400,
    maxDraft: 16,
    status: 'maintenance',
    occupiedUntil: new Date(now.getTime() + 120 * 60000),
    currentShipId: null,
    source: createMockSource('berths.csv', 4, 'berth-003,3号泊位,400,16,maintenance'),
  },
  {
    id: 'berth-004',
    name: '4号泊位',
    maxLength: 250,
    maxDraft: 10,
    status: 'available',
    occupiedUntil: null,
    currentShipId: null,
    source: createMockSource('berths.csv', 5, 'berth-004,4号泊位,250,10,available'),
  },
];

export const mockTugs: Tug[] = [
  {
    id: 'tug-001',
    name: '拖轮A1',
    power: 5000,
    fuelLevel: 85,
    maxFuel: 100,
    availableFrom: new Date(now.getTime()),
    currentAssignment: null,
    status: 'available',
    source: createMockSource('tugs.csv', 2, 'tug-001,拖轮A1,5000,85'),
  },
  {
    id: 'tug-002',
    name: '拖轮A2',
    power: 5000,
    fuelLevel: 92,
    maxFuel: 100,
    availableFrom: new Date(now.getTime()),
    currentAssignment: null,
    status: 'available',
    source: createMockSource('tugs.csv', 3, 'tug-002,拖轮A2,5000,92'),
  },
  {
    id: 'tug-003',
    name: '拖轮B1',
    power: 6000,
    fuelLevel: 45,
    maxFuel: 100,
    availableFrom: new Date(now.getTime()),
    currentAssignment: null,
    status: 'available',
    source: createMockSource('tugs.csv', 4, 'tug-003,拖轮B1,6000,45'),
  },
  {
    id: 'tug-004',
    name: '拖轮B2',
    power: 6000,
    fuelLevel: 78,
    maxFuel: 100,
    availableFrom: new Date(now.getTime() + 45 * 60000),
    currentAssignment: null,
    status: 'refueling',
    source: createMockSource('tugs.csv', 5, 'tug-004,拖轮B2,6000,78'),
  },
  {
    id: 'tug-005',
    name: '拖轮C1',
    power: 8000,
    fuelLevel: 95,
    maxFuel: 100,
    availableFrom: new Date(now.getTime()),
    currentAssignment: null,
    status: 'available',
    source: createMockSource('tugs.csv', 6, 'tug-005,拖轮C1,8000,95'),
  },
];

const generateWeatherForecast = (startTime: Date, hours: number): Weather[] => {
  const forecast: Weather[] = [];
  const wavePattern = [1.2, 1.0, 0.8, 1.5, 2.5, 3.8, 4.5, 5.2, 4.8, 3.5, 2.2, 1.5, 1.0, 0.8, 1.2, 2.0, 3.0, 4.0, 3.2, 2.0, 1.2, 0.8, 1.0, 1.5];
  
  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60 * 60000);
    const waveHeight = wavePattern[i % wavePattern.length] + (Math.random() - 0.5) * 0.5;
    const windLevel = Math.round(waveHeight * 2 + Math.random() * 2);
    const windowType = waveHeight < 2.0 ? 'operable' : waveHeight < 3.5 ? 'warning' : 'restricted';
    
    forecast.push({
      id: `weather-${i.toString().padStart(3, '0')}`,
      timestamp,
      windLevel: Math.max(0, Math.min(10, windLevel)),
      waveHeight: Math.max(0, Math.round(waveHeight * 10) / 10),
      windowType,
      source: createMockSource(
        'weather.csv', 
        i + 2, 
        `weather-${i.toString().padStart(3, '0')},${timestamp.toISOString()},${windLevel},${waveHeight.toFixed(1)}`
      ),
    });
  }
  
  return forecast;
};

export const mockWeather: Weather[] = generateWeatherForecast(now, 24);

export const getInitialGameTime = () => new Date(now.getTime());
export const getGameEndTime = () => new Date(now.getTime() + 24 * 60 * 60000);
