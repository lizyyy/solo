export interface FilmParams {
  thickness: number;
  refractiveIndex: number;
  incidentAngle: number;
  angleUnit: 'degree' | 'radian';
  wavelengthRange: {
    min: number;
    max: number;
  };
  substrateN: number;
  ambientN: number;
  polarization: 's' | 'p' | 'unpolarized';
}

export interface ValidationWarning {
  id: string;
  level: 'error' | 'warning' | 'info';
  field: keyof FilmParams | 'general';
  message: string;
  affectedCalculations: string[];
  suggestion: string;
}

export interface SpectrumPoint {
  wavelength: number;
  reflectance: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export interface CalculationResult {
  params: FilmParams;
  spectrum: SpectrumPoint[];
  reflectedColor: RGB;
  xyz: XYZ;
  dominantWavelength: number;
  colorTemperature: number;
  interferenceOrder: number;
  opticalPathDiff: number;
  timestamp: number;
  engineVersion: string;
}

export interface ComparisonGroup {
  id: string;
  name: string;
  params: FilmParams;
  result: CalculationResult;
  createdAt: number;
}

export interface Reference {
  id: string;
  title: string;
  authors: string;
  year: number;
  source: string;
}

export interface VersionMeta {
  engineVersion: string;
  modelName: string;
  modelDescription: string;
  references: Reference[];
  lastUpdated: string;
}

export interface CIEMatchingData {
  wavelength: number;
  x: number;
  y: number;
  z: number;
}

export interface D65SpectrumData {
  wavelength: number;
  intensity: number;
}

export interface MediumRefractiveIndex {
  name: string;
  refractiveIndex: number;
  wavelength: number;
}
