import fs from 'fs';
import { parseStringPromise } from 'xml2js';
import Papa from 'papaparse';

export async function parseKML(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = await parseStringPromise(content, { explicitArray: false });
  
  const kml = result.kml;
  const document = kml.Document || kml.Folder;
  
  const flightData = {
    name: document?.name || '未命名航线',
    description: document?.description || '',
    waypoints: [],
    flightPath: [],
    homePoint: null,
    takeoffPoint: null,
    landingPoint: null
  };

  const processPlacemark = (placemark) => {
    const name = placemark.name || '';
    const description = placemark.description || '';
    
    if (placemark.Point) {
      const coords = parseCoordinates(placemark.Point.coordinates);
      const pointType = detectPointType(name, description);
      
      if (pointType === 'home') {
        flightData.homePoint = { name, coordinates: coords[0] };
      } else if (pointType === 'takeoff') {
        flightData.takeoffPoint = { name, coordinates: coords[0] };
      } else if (pointType === 'landing') {
        flightData.landingPoint = { name, coordinates: coords[0] };
      } else {
        flightData.waypoints.push({ name, coordinates: coords[0] });
      }
    }
    
    if (placemark.LineString) {
      const coords = parseCoordinates(placemark.LineString.coordinates);
      flightData.flightPath = coords;
      
      if (coords.length > 0 && !flightData.homePoint) {
        flightData.homePoint = { name: '起飞点', coordinates: coords[0] };
      }
    }
    
    if (placemark.Polygon) {
      const outerBoundary = placemark.Polygon.outerBoundaryIs || placemark.Polygon.outerBoundary;
      if (outerBoundary) {
        const linearRing = outerBoundary.LinearRing;
        if (linearRing) {
          const coords = parseCoordinates(linearRing.coordinates);
          flightData.flightPath = coords;
        }
      }
    }
  };

  const placemarks = document?.Placemark;
  if (placemarks) {
    if (Array.isArray(placemarks)) {
      placemarks.forEach(processPlacemark);
    } else {
      processPlacemark(placemarks);
    }
  }

  const folders = document?.Folder;
  if (folders) {
    const folderList = Array.isArray(folders) ? folders : [folders];
    folderList.forEach(folder => {
      const folderPlacemarks = folder.Placemark;
      if (folderPlacemarks) {
        if (Array.isArray(folderPlacemarks)) {
          folderPlacemarks.forEach(processPlacemark);
        } else {
          processPlacemark(folderPlacemarks);
        }
      }
    });
  }

  if (flightData.flightPath.length > 0 && flightData.waypoints.length === 0) {
    flightData.waypoints = flightData.flightPath.map((coord, index) => ({
      name: `航点 ${index + 1}`,
      coordinates: coord
    }));
  }

  return flightData;
}

function parseCoordinates(coordinateString) {
  if (!coordinateString) return [];
  
  const coords = coordinateString.trim().split(/\s+/);
  return coords.map(coord => {
    const parts = coord.split(',');
    return {
      longitude: parseFloat(parts[0]),
      latitude: parseFloat(parts[1]),
      altitude: parts[2] ? parseFloat(parts[2]) : 0
    };
  }).filter(coord => !isNaN(coord.latitude) && !isNaN(coord.longitude));
}

function detectPointType(name, description) {
  const lowerName = (name + ' ' + description).toLowerCase();
  
  if (lowerName.includes('home') || lowerName.includes('返航') || lowerName.includes('家')) {
    return 'home';
  }
  if (lowerName.includes('takeoff') || lowerName.includes('起飞')) {
    return 'takeoff';
  }
  if (lowerName.includes('landing') || lowerName.includes('land') || lowerName.includes('降落')) {
    return 'landing';
  }
  return 'waypoint';
}

export async function parseGeoJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const geojson = JSON.parse(content);
  
  const result = {
    type: geojson.type,
    features: []
  };

  const processFeature = (feature) => {
    const processed = {
      type: feature.type,
      properties: { ...feature.properties },
      geometry: feature.geometry
    };

    const props = feature.properties || {};
    const lowerProps = Object.keys(props).reduce((acc, key) => {
      acc[key.toLowerCase()] = props[key];
      return acc;
    }, {});

    const name = lowerProps.name || props.name || '未命名区域';
    const type = detectZoneType(name, lowerProps);
    
    processed.properties._zoneType = type;
    processed.properties._name = name;

    if (type === 'no_fly') {
      processed.properties._restriction = '禁飞区';
      processed.properties._maxAltitude = 0;
    } else if (type === 'height_limit') {
      const maxAlt = lowerProps.maxheight || lowerProps.max_altitude || lowerProps.限高 || props.maxHeight;
      processed.properties._restriction = '限高区';
      processed.properties._maxAltitude = maxAlt ? parseFloat(maxAlt) : 120;
    }

    result.features.push(processed);
  };

  if (geojson.type === 'FeatureCollection') {
    if (geojson.features) {
      geojson.features.forEach(processFeature);
    }
  } else if (geojson.type === 'Feature') {
    processFeature(geojson);
  }

  return result;
}

function detectZoneType(name, props) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('no-fly') || lowerName.includes('nofly') || 
      lowerName.includes('禁飞') || lowerName.includes('restricted') ||
      lowerName.includes('exclusion')) {
    return 'no_fly';
  }
  
  if (lowerName.includes('height') || lowerName.includes('altitude') ||
      lowerName.includes('限高') || lowerName.includes('ceiling')) {
    return 'height_limit';
  }
  
  if (props.type) {
    const propType = String(props.type).toLowerCase();
    if (propType.includes('no-fly') || propType.includes('nofly') || propType.includes('禁飞')) {
      return 'no_fly';
    }
    if (propType.includes('height') || propType.includes('限高')) {
      return 'height_limit';
    }
  }
  
  return 'restricted';
}

export async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const batteries = {};
        
        results.data.forEach((row, index) => {
          const batteryId = extractBatteryId(row, index);
          
          if (!batteries[batteryId]) {
            batteries[batteryId] = {
              batteryId: batteryId,
              cycles: 0,
              lastUsed: null,
              lastUsedTime: null,
              history: []
            };
          }
          
          const cycleCount = extractCycleCount(row);
          const usageTime = extractUsageTime(row);
          const usageDate = extractUsageDate(row);
          
          batteries[batteryId].history.push({
            rowIndex: index,
            cycleCount: cycleCount,
            usageTime: usageTime,
            usageDate: usageDate,
            rawData: row
          });
          
          if (cycleCount > batteries[batteryId].cycles) {
            batteries[batteryId].cycles = cycleCount;
          }
          
          if (usageDate && (!batteries[batteryId].lastUsedTime || 
              usageDate > batteries[batteryId].lastUsedTime)) {
            batteries[batteryId].lastUsedTime = usageDate;
            batteries[batteryId].lastUsed = formatDate(usageDate);
          }
        });
        
        resolve({
          batteries: Object.values(batteries),
          rawData: results.data,
          meta: results.meta
        });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

function extractBatteryId(row, index) {
  const possibleKeys = ['batteryId', 'battery_id', '电池编号', '电池ID', 'id', 'ID', '编号'];
  
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return String(row[key]).trim();
    }
  }
  
  return `电池_${index + 1}`;
}

function extractCycleCount(row) {
  const possibleKeys = ['cycles', 'cycleCount', 'cycle_count', '循环次数', '充放循环', '循环', 'cycle'];
  
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null) {
      const value = parseFloat(row[key]);
      if (!isNaN(value)) {
        return value;
      }
    }
  }
  
  return 0;
}

function extractUsageTime(row) {
  const possibleKeys = ['usageTime', 'usage_time', '使用时间', '飞行时间', 'lastUsed', 'last_used', '上次使用'];
  
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return String(row[key]).trim();
    }
  }
  
  return null;
}

function extractUsageDate(row) {
  const possibleKeys = ['date', 'usageDate', 'usage_date', '日期', '使用日期', '飞行日期', 'time', '时间'];
  
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const dateStr = String(row[key]).trim();
      const timestamp = Date.parse(dateStr);
      if (!isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }
  }
  
  return null;
}

function formatDate(date) {
  if (!date) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
