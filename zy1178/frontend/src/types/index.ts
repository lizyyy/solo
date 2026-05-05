export interface Point {
  x: number;
  y: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export interface Roof {
  id: number;
  project_id: number;
  name: string;
  coordinates: Point[];
  area: number;
  inclination: number;
  azimuth: number;
  created_at: string;
}

export interface Obstacle {
  id: number;
  project_id: number;
  name: string;
  coordinates: Point[];
  height: number;
  type: string;
  created_at: string;
}

export interface Panel {
  id: number;
  project_id: number;
  model: string;
  power: number;
  efficiency: number;
  width: number;
  height: number;
  temperature_coefficient: number;
  lifetime: number;
  degradation_rate: number;
  created_at: string;
}

export interface HourlyData {
  id: number;
  project_id: number;
  timestamp: string;
  global_irradiance: number;
  direct_irradiance?: number;
  diffuse_irradiance?: number;
  temperature?: number;
  wind_speed?: number;
  electricity_price: number;
  feed_in_tariff?: number;
  created_at: string;
}

export interface Layout {
  id: number;
  project_id: number;
  name: string;
  panel_positions: Array<{ x: number; y: number; [key: string]: any }>;
  panel_count: number;
  total_power: number;
  is_active: boolean;
  created_at: string;
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

export interface CalculationResult {
  id: number;
  project_id: number;
  layout_id: number;
  shading_map?: {
    grid_size: number;
    bounds: { minx: number; miny: number; maxx: number; maxy: number };
    points: Array<{ x: number; y: number; shading_ratio: number }>;
  };
  shading_hours: number;
  shading_loss_ratio: number;
  installable_capacity: number;
  actual_capacity: number;
  annual_generation: number;
  monthly_generation?: number[];
  annual_revenue: number;
  monthly_revenue?: number[];
  initial_investment?: number;
  payback_period?: number;
  net_present_value?: number;
  internal_rate_of_return?: number;
  risk_factors?: RiskFactor[];
  created_at: string;
}
