"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateLocation = findOrCreateLocation;
exports.getLocationById = getLocationById;
exports.getAllLocations = getAllLocations;
exports.getLocationAliases = getLocationAliases;
exports.updateLocation = updateLocation;
exports.mergeLocations = mergeLocations;
exports.searchLocations = searchLocations;
const database_1 = __importDefault(require("../database"));
const utils_1 = require("../utils");
function findOrCreateLocation(name, lat, lng, address, street, district) {
    const normalizedName = (0, utils_1.normalizeLocationName)(name);
    const existingByCoords = database_1.default.locations.filter((loc) => {
        const dist = (0, utils_1.calculateDistance)(lat, lng, loc.lat, loc.lng);
        return dist < 50;
    }).sort((a, b) => {
        const distA = (0, utils_1.calculateDistance)(lat, lng, a.lat, a.lng);
        const distB = (0, utils_1.calculateDistance)(lat, lng, b.lat, b.lng);
        return distA - distB;
    });
    for (const loc of existingByCoords) {
        const existingAlias = database_1.default.location_aliases.findOne((a) => a.locationId === loc.id && a.alias === name);
        if (!existingAlias) {
            database_1.default.location_aliases.insert({
                locationId: loc.id,
                alias: name,
                isManual: 0
            });
        }
        const aliases = database_1.default.location_aliases.filter((a) => a.locationId === loc.id).map((a) => a.alias);
        return { location: loc, isNew: false, aliases };
    }
    const existingByName = database_1.default.locations.findOne((loc) => loc.normalizedName === normalizedName);
    if (existingByName) {
        const existingAlias = database_1.default.location_aliases.findOne((a) => a.locationId === existingByName.id && a.alias === name);
        if (!existingAlias) {
            database_1.default.location_aliases.insert({
                locationId: existingByName.id,
                alias: name,
                isManual: 0
            });
        }
        const aliases = database_1.default.location_aliases.filter((a) => a.locationId === existingByName.id).map((a) => a.alias);
        return { location: existingByName, isNew: false, aliases };
    }
    const result = database_1.default.locations.insert({
        name,
        normalizedName,
        address: address || null,
        lat,
        lng,
        street: street || null,
        district: district || null
    });
    const locationId = result.lastInsertRowid;
    database_1.default.location_aliases.insert({
        locationId,
        alias: name,
        isManual: 1
    });
    const newLocation = database_1.default.locations.get(locationId);
    return { location: newLocation, isNew: true, aliases: [name] };
}
function getLocationById(id) {
    return database_1.default.locations.get(id);
}
function getAllLocations() {
    return database_1.default.locations.all();
}
function getLocationAliases(locationId) {
    return database_1.default.location_aliases.filter((a) => a.locationId === locationId).sort((a, b) => {
        if (a.isManual === b.isManual)
            return 0;
        return a.isManual ? -1 : 1;
    }).map((a) => a.alias);
}
function updateLocation(id, updates) {
    const { id: _, createdAt: __, ...data } = updates;
    database_1.default.locations.update(id, data);
    return getLocationById(id);
}
function mergeLocations(targetId, sourceIds) {
    let mergedCount = 0;
    for (const sourceId of sourceIds) {
        if (sourceId === targetId)
            continue;
        const sourceAliases = getLocationAliases(sourceId);
        for (const alias of sourceAliases) {
            const existing = database_1.default.location_aliases.findOne((a) => a.locationId === targetId && a.alias === alias);
            if (!existing) {
                database_1.default.location_aliases.insert({
                    locationId: targetId,
                    alias,
                    isManual: 0
                });
            }
        }
        database_1.default.resident_feedbacks.filter((f) => f.locationId === sourceId).forEach((f) => {
            database_1.default.resident_feedbacks.update(f.id, { locationId: targetId });
        });
        database_1.default.inspection_photos.filter((p) => p.locationId === sourceId).forEach((p) => {
            database_1.default.inspection_photos.update(p.id, { locationId: targetId });
        });
        database_1.default.plan_versions.filter((p) => p.locationId === sourceId).forEach((p) => {
            database_1.default.plan_versions.update(p.id, { locationId: targetId });
        });
        database_1.default.reports.filter((r) => r.locationId === sourceId).forEach((r) => {
            database_1.default.reports.update(r.id, { locationId: targetId });
        });
        database_1.default.data_conflicts.filter((c) => c.locationId === sourceId).forEach((c) => {
            database_1.default.data_conflicts.update(c.id, { locationId: targetId });
        });
        database_1.default.location_aliases.deleteWhere((a) => a.locationId === sourceId);
        database_1.default.locations.delete(sourceId);
        mergedCount++;
    }
    return mergedCount;
}
function searchLocations(query) {
    const normalized = (0, utils_1.normalizeLocationName)(query);
    const byName = database_1.default.locations.filter((l) => l.normalizedName.includes(normalized));
    const byAlias = database_1.default.location_aliases.filter((a) => a.alias.includes(query)).map((a) => database_1.default.locations.get(a.locationId));
    const ids = new Set();
    const result = [];
    [...byName, ...byAlias].forEach((loc) => {
        if (loc && !ids.has(loc.id)) {
            ids.add(loc.id);
            result.push(loc);
        }
    });
    return result;
}
