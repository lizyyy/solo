const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
const { createError, wrapError } = require('./utils/errors');

class KMLParser {
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
  }

  parse(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const filename = filePath.split('/').pop();
      
      let kmlData;
      try {
        kmlData = this.parser.parse(content);
      } catch (e) {
        throw createError('KML_PARSE_FAILED', filename);
      }
      
      const coordinates = this._extractCoordinates(kmlData);
      
      if (coordinates.length === 0) {
        throw createError('NO_COORDINATES', filename);
      }
      
      return {
        filename,
        waypoints: coordinates,
        totalDistance: this._calculateTotalDistance(coordinates),
        maxAltitude: this._calculateMaxAltitude(coordinates),
        parsedAt: new Date().toISOString()
      };
      
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw createError('FILE_NOT_FOUND', filePath.split('/').pop());
      }
      throw wrapError(e, '解析航线文件');
    }
  }

  _extractCoordinates(kmlData) {
    const coords = [];
    const placemarks = this._findAllPlacemarks(kmlData);
    
    for (const placemark of placemarks) {
      const coordStr = this._getCoordinateString(placemark);
      if (coordStr) {
        const points = this._parseCoordinateString(coordStr);
        coords.push(...points);
      }
    }
    
    return coords;
  }

  _findAllPlacemarks(obj, results = []) {
    if (!obj || typeof obj !== 'object') return results;
    
    if (obj.Placemark) {
      if (Array.isArray(obj.Placemark)) {
        results.push(...obj.Placemark);
      } else {
        results.push(obj.Placemark);
      }
    }
    
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        this._findAllPlacemarks(obj[key], results);
      }
    }
    
    return results;
  }

  _getCoordinateString(placemark) {
    if (placemark.Point?.coordinates) {
      return placemark.Point.coordinates;
    }
    if (placemark.LineString?.coordinates) {
      return placemark.LineString.coordinates;
    }
    if (placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates) {
      return placemark.Polygon.outerBoundaryIs.LinearRing.coordinates;
    }
    return null;
  }

  _parseCoordinateString(coordStr) {
    return coordStr
      .trim()
      .split(/\s+/)
      .filter(line => line.includes(','))
      .map(line => {
        const [lng, lat, alt = 0] = line.split(',').map(n => parseFloat(n.trim()));
        return { lat, lng, alt };
      })
      .filter(p => !isNaN(p.lat) && !isNaN(p.lng));
  }

  _calculateTotalDistance(points) {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this._haversineDistance(points[i - 1], points[i]);
    }
    return total;
  }

  _haversineDistance(p1, p2) {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _calculateMaxAltitude(points) {
    return Math.max(...points.map(p => p.alt || 0));
  }
}

module.exports = KMLParser;
