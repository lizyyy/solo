import db from '../database';
import { normalizeLocationName, calculateDistance } from '../utils';
import type { Location, LocationAlias } from '../types';

export function findOrCreateLocation(
  name: string,
  lat: number,
  lng: number,
  address?: string,
  street?: string,
  district?: string
): { location: Location; isNew: boolean; aliases: string[] } {
  const normalizedName = normalizeLocationName(name);
  
  const existingByCoords = db.locations.filter((loc: any) => {
    const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
    return dist < 50;
  }).sort((a: any, b: any) => {
    const distA = calculateDistance(lat, lng, a.lat, a.lng);
    const distB = calculateDistance(lat, lng, b.lat, b.lng);
    return distA - distB;
  });

  for (const loc of existingByCoords) {
    const existingAlias = db.location_aliases.findOne((a: any) => a.locationId === loc.id && a.alias === name);
    
    if (!existingAlias) {
      db.location_aliases.insert({
        locationId: loc.id,
        alias: name,
        isManual: 0
      });
    }
    
    const aliases = db.location_aliases.filter((a: any) => a.locationId === loc.id).map((a: any) => a.alias);
    
    return { location: loc, isNew: false, aliases };
  }

  const existingByName = db.locations.findOne((loc: any) => loc.normalizedName === normalizedName);

  if (existingByName) {
    const existingAlias = db.location_aliases.findOne((a: any) => a.locationId === existingByName.id && a.alias === name);
    
    if (!existingAlias) {
      db.location_aliases.insert({
        locationId: existingByName.id,
        alias: name,
        isManual: 0
      });
    }
    
    const aliases = db.location_aliases.filter((a: any) => a.locationId === existingByName.id).map((a: any) => a.alias);
    
    return { location: existingByName, isNew: false, aliases };
  }

  const result = db.locations.insert({
    name,
    normalizedName,
    address: address || null,
    lat,
    lng,
    street: street || null,
    district: district || null
  });

  const locationId = result.lastInsertRowid;
  
  db.location_aliases.insert({
    locationId,
    alias: name,
    isManual: 1
  });

  const newLocation = db.locations.get(locationId) as Location;

  return { location: newLocation, isNew: true, aliases: [name] };
}

export function getLocationById(id: number): Location | undefined {
  return db.locations.get(id) as Location | undefined;
}

export function getAllLocations(): Location[] {
  return db.locations.all() as Location[];
}

export function getLocationAliases(locationId: number): string[] {
  return db.location_aliases.filter((a: any) => a.locationId === locationId).sort((a: any, b: any) => {
    if (a.isManual === b.isManual) return 0;
    return a.isManual ? -1 : 1;
  }).map((a: any) => a.alias);
}

export function updateLocation(id: number, updates: Partial<Location>): Location | undefined {
  const { id: _, createdAt: __, ...data } = updates as any;
  db.locations.update(id, data);
  return getLocationById(id);
}

export function mergeLocations(targetId: number, sourceIds: number[]): number {
  let mergedCount = 0;
  
  for (const sourceId of sourceIds) {
    if (sourceId === targetId) continue;
    
    const sourceAliases = getLocationAliases(sourceId);
    
    for (const alias of sourceAliases) {
      const existing = db.location_aliases.findOne((a: any) => a.locationId === targetId && a.alias === alias);
      if (!existing) {
        db.location_aliases.insert({
          locationId: targetId,
          alias,
          isManual: 0
        });
      }
    }
    
    db.resident_feedbacks.filter((f: any) => f.locationId === sourceId).forEach((f: any) => {
      db.resident_feedbacks.update(f.id, { locationId: targetId });
    });
    
    db.inspection_photos.filter((p: any) => p.locationId === sourceId).forEach((p: any) => {
      db.inspection_photos.update(p.id, { locationId: targetId });
    });
    
    db.plan_versions.filter((p: any) => p.locationId === sourceId).forEach((p: any) => {
      db.plan_versions.update(p.id, { locationId: targetId });
    });
    
    db.reports.filter((r: any) => r.locationId === sourceId).forEach((r: any) => {
      db.reports.update(r.id, { locationId: targetId });
    });
    
    db.data_conflicts.filter((c: any) => c.locationId === sourceId).forEach((c: any) => {
      db.data_conflicts.update(c.id, { locationId: targetId });
    });
    
    db.location_aliases.deleteWhere((a: any) => a.locationId === sourceId);
    db.locations.delete(sourceId);
    mergedCount++;
  }
  
  return mergedCount;
}

export function searchLocations(query: string): Location[] {
  const normalized = normalizeLocationName(query);
  const byName = db.locations.filter((l: any) => 
    l.normalizedName.includes(normalized)
  );
  const byAlias = db.location_aliases.filter((a: any) => 
    a.alias.includes(query)
  ).map((a: any) => db.locations.get(a.locationId));
  
  const ids = new Set();
  const result: Location[] = [];
  
  [...byName, ...byAlias].forEach((loc: any) => {
    if (loc && !ids.has(loc.id)) {
      ids.add(loc.id);
      result.push(loc);
    }
  });
  
  return result;
}
