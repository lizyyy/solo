export interface Artwork {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface Light {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  intensity: number;
  spread: number;
}

export interface Wall {
  id: string;
  name: string;
  width: number;
  height: number;
  artworks: Artwork[];
  lights: Light[];
}

export interface IlluminationResult {
  artworkId: string;
  artworkName: string;
  averageLux: number;
  minLux: number;
  maxLux: number;
  shadowIntensity: number;
  lightAngles: { lightId: string; angle: number }[];
  errors: string[];
}

export interface DataValidationError {
  type: 'duplicate' | 'missing' | 'invalid';
  field: string;
  message: string;
  id?: string;
}
