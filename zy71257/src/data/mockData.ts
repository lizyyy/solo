import { 
  Route, 
  Aircraft, 
  FlightData, 
  AnomalyType, 
  FieldType,
  SensitiveFieldConfig,
  UserPermission,
  DataStatus
} from '../types';

export const ROUTES: Route[] = [
  { id: 'R001', origin: '北京(PEK)', destination: '上海(PVG)', distance: 1180, status: 'confirmed' },
  { id: 'R002', origin: '北京(PEK)', destination: '广州(CAN)', distance: 1880, status: 'confirmed' },
  { id: 'R003', origin: '北京(PEK)', destination: '深圳(SZX)', distance: 1970, status: 'confirmed' },
  { id: 'R004', origin: '上海(PVG)', destination: '广州(CAN)', distance: 1230, status: 'confirmed' },
  { id: 'R005', origin: '上海(PVG)', destination: '成都(CTU)', distance: 1670, status: 'tentative' },
  { id: 'R006', origin: '广州(CAN)', destination: '成都(CTU)', distance: 1220, status: 'confirmed' },
  { id: 'R007', origin: '北京(PEK)', destination: '纽约(JFK)', distance: 10980, status: 'confirmed' },
  { id: 'R008', origin: '上海(PVG)', destination: '伦敦(LHR)', distance: 9200, status: 'tentative' },
  { id: 'R009', origin: '广州(CAN)', destination: '洛杉矶(LAX)', distance: 11600, status: 'confirmed' },
  { id: 'R010', origin: '北京(PEK)', destination: '三亚(SYX)', distance: 2540, status: 'confirmed' },
  { id: 'R011', origin: '上海(PVG)', destination: '三亚(SYX)', distance: 1890, status: 'confirmed' },
  { id: 'R012', origin: '成都(CTU)', destination: '拉萨(LXA)', distance: 1250, status: 'tentative' },
];

export const AIRCRAFT: Aircraft[] = [
  { id: 'A001', model: 'B737-800', registration: 'B-1234', seatCount: 168, status: 'confirmed' },
  { id: 'A002', model: 'B737-800', registration: 'B-1235', seatCount: 168, status: 'confirmed' },
  { id: 'A003', model: 'A320neo', registration: 'B-2345', seatCount: 158, status: 'confirmed' },
  { id: 'A004', model: 'A320neo', registration: 'B-2346', seatCount: 158, status: 'tentative' },
  { id: 'A005', model: 'B787-9', registration: 'B-3456', seatCount: 294, status: 'confirmed' },
  { id: 'A006', model: 'B787-9', registration: 'B-3457', seatCount: 294, status: 'confirmed' },
  { id: 'A007', model: 'A350-900', registration: 'B-4567', seatCount: 315, status: 'confirmed' },
  { id: 'A008', model: 'B777-300ER', registration: 'B-5678', seatCount: 368, status: 'tentative' },
  { id: 'A009', model: 'A330-300', registration: 'B-6789', seatCount: 284, status: 'confirmed' },
  { id: 'A010', model: 'B737-MAX8', registration: 'B-7890', seatCount: 178, status: 'tentative' },
];

const aircraftFuelRates: Record<string, number> = {
  'B737-800': 2.6,
  'A320neo': 2.4,
  'B787-9': 5.6,
  'A350-900': 5.8,
  'B777-300ER': 7.2,
  'A330-300': 5.2,
  'B737-MAX8': 2.3,
};

const carbonFactorBase = 3.16;

function generateFlightData(): FlightData[] {
  const data: FlightData[] = [];
  const startDate = new Date('2026-01-01');
  
  for (let day = 0; day < 90; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    ROUTES.forEach((route, routeIdx) => {
      AIRCRAFT.forEach((aircraft, aircraftIdx) => {
        if (Math.random() > 0.7) return;
        
        const id = `F${dateStr.replace(/-/g, '')}${route.id}${aircraft.id}`;
        const fuelRate = aircraftFuelRates[aircraft.model] || 2.5;
        const fuelConsumption = route.distance * fuelRate * (0.9 + Math.random() * 0.2);
        const carbonFactor = carbonFactorBase * (0.95 + Math.random() * 0.1);
        const carbonEmission = fuelConsumption * carbonFactor;
        
        let loadFactor: number | null = Math.round((60 + Math.random() * 35) * 10) / 10;
        
        const anomalies: AnomalyType[] = [];
        const fieldStatuses: Record<FieldType, DataStatus> = {
          route: route.status,
          aircraftType: aircraft.status,
          loadFactor: 'confirmed',
          fuelConsumption: 'confirmed',
          carbonFactor: 'confirmed',
          operationReport: 'confirmed',
        };
        
        if ((routeIdx + aircraftIdx) % 11 === 0) {
          loadFactor = null;
          anomalies.push('missing_load_factor');
          fieldStatuses.loadFactor = 'tentative';
        }
        
        if ((routeIdx + aircraftIdx) % 13 === 0) {
          anomalies.push('aircraft_mapping_error');
          fieldStatuses.aircraftType = 'tentative';
        }
        
        if (route.distance > 8000 && (routeIdx + aircraftIdx) % 7 === 0) {
          anomalies.push('extreme_route_occlusion');
        }
        
        if (carbonEmission > 50000) {
          anomalies.push('high_emission');
        }
        
        if (loadFactor !== null && loadFactor < 65) {
          anomalies.push('low_load_factor');
        }
        
        const hasTentative = Object.values(fieldStatuses).some(s => s === 'tentative');
        const status: DataStatus = hasTentative ? 'tentative' : 'confirmed';
        
        data.push({
          id,
          routeId: route.id,
          aircraftId: aircraft.id,
          date: dateStr,
          loadFactor,
          fuelConsumption: Math.round(fuelConsumption),
          carbonFactor: Math.round(carbonFactor * 1000) / 1000,
          carbonEmission: Math.round(carbonEmission),
          passengerCount: loadFactor ? Math.round(aircraft.seatCount * loadFactor / 100) : 0,
          status,
          fieldStatuses,
          anomalies,
          remarks: anomalies.length > 0 ? '需要数据校验' : undefined,
        });
      });
    });
  }
  
  return data;
}

export const FLIGHT_DATA: FlightData[] = generateFlightData();

export const SENSITIVE_FIELDS: SensitiveFieldConfig[] = [
  { field: 'registration', displayName: '飞机注册号', requiresPermission: true, maskPattern: '****' },
  { field: 'fuelConsumption', displayName: '燃油消耗', requiresPermission: false, maskPattern: '' },
  { field: 'passengerCount', displayName: '旅客人数', requiresPermission: true, maskPattern: '***' },
];

export const DEFAULT_PERMISSION: UserPermission = {
  canViewSensitive: true,
  canExport: true,
  canEdit: true,
  role: 'admin',
};

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  missing_load_factor: '载客率缺失',
  aircraft_mapping_error: '机型映射错误',
  extreme_route_occlusion: '极端航线遮挡',
  high_emission: '高碳排放',
  low_load_factor: '低载客率',
};

export const FIELD_LABELS: Record<FieldType, string> = {
  route: '航线',
  aircraftType: '机型',
  loadFactor: '载客率',
  fuelConsumption: '燃油',
  carbonFactor: '碳排因子',
  operationReport: '运营报告',
};
