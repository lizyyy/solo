import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { Hall, Booth, FlowZone, PowerZone, Size, Position, BoothType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const importService = {
  async parseHallJson(content: string): Promise<Hall> {
    const data = JSON.parse(content);
    return {
      id: data.id || uuidv4(),
      name: data.name || 'Unnamed Hall',
      dimensions: data.dimensions || { width: 40, depth: 30, height: 6 },
      gridSize: data.gridSize || 1,
      entrances: data.entrances || [],
      exits: data.exits || [],
      walls: data.walls || [],
      pillars: data.pillars || [],
      fixedObstacles: data.fixedObstacles || []
    };
  },

  async parseBoothsCsv(content: string): Promise<Booth[]> {
    return new Promise((resolve, reject) => {
      const results: Booth[] = [];
      const stream = Readable.from(content);

      stream
        .pipe(csvParser())
        .on('data', (row) => {
          const booth = this.parseBoothRow(row);
          if (booth) {
            results.push(booth);
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  },

  parseBoothRow(row: Record<string, string>): Booth | null {
    if (!row.name) return null;

    const position: Position = {
      x: parseFloat(row.x) || 0,
      y: parseFloat(row.y) || 0,
      z: parseFloat(row.z) || 0
    };

    const size: Size = {
      width: parseFloat(row.width) || 3,
      depth: parseFloat(row.depth) || 3,
      height: parseFloat(row.height) || 2.5
    };

    const type = (row.type as BoothType) || 'standard';

    return {
      id: row.id || uuidv4(),
      name: row.name,
      type: this.validateBoothType(type),
      position,
      size,
      rotation: parseFloat(row.rotation) || 0,
      isPopular: this.parseBoolean(row.is_popular) || this.parseBoolean(row.isPopular) || false,
      powerDemand: parseFloat(row.power_demand) || parseFloat(row.powerDemand) || 500,
      powerZoneId: row.power_zone_id || row.powerZoneId,
      contactName: row.contact_name || row.contactName,
      contactPhone: row.contact_phone || row.contactPhone,
      notes: row.notes,
      props: []
    };
  },

  validateBoothType(type: string): BoothType {
    const validTypes: BoothType[] = [
      'standard', 'corner', 'island', 'double', 'premium',
      'stage', 'info_desk', 'food', 'sponsor', 'other'
    ];
    return validTypes.includes(type as BoothType) ? (type as BoothType) : 'other';
  },

  parseBoolean(value: string | undefined): boolean {
    if (!value) return false;
    const lower = value.toLowerCase().trim();
    return ['true', 'yes', '1', 'y'].includes(lower);
  },

  async parseFlowCsv(content: string): Promise<FlowZone[]> {
    return new Promise((resolve, reject) => {
      const results: FlowZone[] = [];
      const stream = Readable.from(content);

      stream
        .pipe(csvParser())
        .on('data', (row) => {
          const zone = this.parseFlowRow(row);
          if (zone) {
            results.push(zone);
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  },

  parseFlowRow(row: Record<string, string>): FlowZone | null {
    if (!row.name) return null;

    return {
      id: row.id || uuidv4(),
      name: row.name,
      position: {
        x: parseFloat(row.x) || 0,
        y: parseFloat(row.y) || 0
      },
      size: {
        width: parseFloat(row.width) || 5,
        depth: parseFloat(row.depth) || 5
      },
      expectedFootTraffic: parseInt(row.expected_foot_traffic || row.expectedFootTraffic || '100'),
      priority: (row.priority as 'high' | 'medium' | 'low') || 'medium'
    };
  },

  async parsePowerZonesJson(content: string): Promise<PowerZone[]> {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data.map((zone) => ({
        id: zone.id || uuidv4(),
        name: zone.name || 'Unnamed Zone',
        position: zone.position || { x: 0, y: 0 },
        size: zone.size || { width: 10, depth: 10 },
        maxPower: zone.maxPower || zone.max_power || 10000,
        circuitBreakers: zone.circuitBreakers || zone.circuit_breakers || []
      }));
    }
    return [];
  }
};
