import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { Route, Waypoint } from '../types';

const waypointSchema = z.object({
  id: z.string(),
  towerId: z.string(),
  index: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number(),
  cameraAngle: z.number().optional(),
  photoRequired: z.boolean().default(true),
  sequence: z.number(),
});

const routeSchema = z.object({
  missionId: z.string(),
  missionName: z.string(),
  flightDate: z.string(),
  pilot: z.string(),
  aircraft: z.string(),
  waypoints: z.array(waypointSchema),
  totalWaypoints: z.number(),
  expectedPhotos: z.number(),
});

export class YamlParser {
  static parseRoute(filePath: string): Route {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content) as unknown;
    
    const result = routeSchema.safeParse(parsed);
    
    if (!result.success) {
      throw new Error(`route.yaml 格式错误: ${result.error.message}`);
    }
    
    return result.data;
  }

  static parseRouteFromDir(inputDir: string): Route {
    const yamlPath = path.join(inputDir, 'route.yaml');
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`找不到航线文件: ${yamlPath}`);
    }
    return this.parseRoute(yamlPath);
  }

  static validateWaypoint(waypoint: Waypoint): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!waypoint.id || waypoint.id.trim() === '') {
      errors.push('航点ID不能为空');
    }
    
    if (!waypoint.towerId || waypoint.towerId.trim() === '') {
      errors.push('杆塔ID不能为空');
    }
    
    if (waypoint.latitude < -90 || waypoint.latitude > 90) {
      errors.push(`纬度超出范围: ${waypoint.latitude}`);
    }
    
    if (waypoint.longitude < -180 || waypoint.longitude > 180) {
      errors.push(`经度超出范围: ${waypoint.longitude}`);
    }
    
    if (waypoint.altitude < 0 || waypoint.altitude > 10000) {
      errors.push(`高度超出合理范围: ${waypoint.altitude}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
}
