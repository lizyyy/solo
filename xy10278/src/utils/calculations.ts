import { Artwork, IlluminationResult, Light } from '../types';

export const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

export const calculateAngleToPoint = (lightX: number, lightY: number, pointX: number, pointY: number): number => {
  const dx = pointX - lightX;
  const dy = -(pointY - lightY);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return angle;
};

export const calculateLux = (
  light: Light,
  pointX: number,
  pointY: number
): number => {
  const distance = calculateDistance(light.x, light.y, pointX, pointY);
  if (distance === 0) return 0;
  
  const angleToPoint = calculateAngleToPoint(light.x, light.y, pointX, pointY);
  const angleDiff = Math.abs(angleToPoint - light.angle);
  
  const normalizedAngleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
  
  if (normalizedAngleDiff > light.spread / 2) {
    return 0;
  }
  
  const angleFactor = 1 - (normalizedAngleDiff / (light.spread / 2));
  const distanceFactor = 1 / (distance * distance);
  
  return light.intensity * angleFactor * distanceFactor;
};

export const calculateArtworkIllumination = (
  artwork: Artwork,
  lights: Light[]
): IlluminationResult => {
  const errors: string[] = [];
  const lightAngles: { lightId: string; angle: number }[] = [];
  
  const centerX = artwork.x + artwork.width / 2;
  const centerY = artwork.y + artwork.height / 2;
  
  let totalLux = 0;
  let minLux = Infinity;
  let maxLux = -Infinity;
  
  const samplePoints = [
    { x: artwork.x, y: artwork.y },
    { x: artwork.x + artwork.width, y: artwork.y },
    { x: artwork.x, y: artwork.y + artwork.height },
    { x: artwork.x + artwork.width, y: artwork.y + artwork.height },
    { x: centerX, y: centerY },
    { x: artwork.x + artwork.width / 4, y: artwork.y + artwork.height / 4 },
    { x: artwork.x + artwork.width * 3 / 4, y: artwork.y + artwork.height / 4 },
    { x: artwork.x + artwork.width / 4, y: artwork.y + artwork.height * 3 / 4 },
    { x: artwork.x + artwork.width * 3 / 4, y: artwork.y + artwork.height * 3 / 4 },
  ];
  
  for (const light of lights) {
    const angleToCenter = calculateAngleToPoint(light.x, light.y, centerX, centerY);
    lightAngles.push({ lightId: light.id, angle: angleToCenter });
  }
  
  for (const point of samplePoints) {
    let pointLux = 0;
    for (const light of lights) {
      pointLux += calculateLux(light, point.x, point.y);
    }
    totalLux += pointLux;
    minLux = Math.min(minLux, pointLux);
    maxLux = Math.max(maxLux, pointLux);
  }
  
  const averageLux = totalLux / samplePoints.length;
  const luxRange = maxLux - minLux;
  const shadowIntensity = averageLux > 0 ? (luxRange / averageLux) * 100 : 0;
  
  if (lights.length === 0) {
    errors.push('作品未被任何灯光照射');
  }
  
  if (averageLux < 50 && lights.length > 0) {
    errors.push('照度过低（<50 lux），建议调整灯位');
  }
  
  if (averageLux > 2000) {
    errors.push('照度过高（>2000 lux），可能损害作品');
  }
  
  if (shadowIntensity > 80) {
    errors.push('阴影强度过高（>80%），建议增加辅助光源');
  }
  
  return {
    artworkId: artwork.id,
    artworkName: artwork.name,
    averageLux: Math.round(averageLux * 100) / 100,
    minLux: Math.round(minLux * 100) / 100,
    maxLux: Math.round(maxLux * 100) / 100,
    shadowIntensity: Math.round(shadowIntensity * 100) / 100,
    lightAngles,
    errors
  };
};
