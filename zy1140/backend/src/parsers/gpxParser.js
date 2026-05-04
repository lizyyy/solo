const xml2js = require('xml2js');
const dayjs = require('dayjs');
const _ = require('lodash');

const { toDateTimeString } = require('../utils/date');

async function parseGPX(gpxContent) {
  const parser = new xml2js.Parser({
    explicitArray: false,
    ignoreAttrs: false,
    mergeAttrs: true,
  });

  const result = await parser.parseStringPromise(gpxContent);
  const gpx = result.gpx || result;

  const metadata = parseMetadata(gpx);
  const tracks = parseTracks(gpx);
  const waypoints = parseWaypoints(gpx);

  const allPoints = tracks.reduce((acc, track) => {
    return [...acc, ...track.points];
  }, []);

  const stats = calculateStats(allPoints, metadata);

  return {
    metadata,
    tracks,
    waypoints,
    points: allPoints,
    stats,
    totalPoints: allPoints.length,
    totalTracks: tracks.length,
  };
}

function parseMetadata(gpx) {
  const metadata = gpx.metadata || {};
  
  return {
    name: metadata.name || null,
    desc: metadata.desc || null,
    author: metadata.author?.name || null,
    time: metadata.time ? toDateTimeString(dayjs(metadata.time)) : null,
    keywords: metadata.keywords ? metadata.keywords.split(/[,\s]+/).filter(Boolean) : [],
    bounds: parseBounds(metadata.bounds),
  };
}

function parseBounds(bounds) {
  if (!bounds) return null;
  
  return {
    minLat: parseFloat(bounds.minlat),
    minLon: parseFloat(bounds.minlon),
    maxLat: parseFloat(bounds.maxlat),
    maxLon: parseFloat(bounds.maxlon),
  };
}

function parseTracks(gpx) {
  if (!gpx.trk) return [];
  
  const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
  const parsedTracks = [];

  for (const trk of tracks) {
    const segments = parseTrackSegments(trk);
    
    const allPoints = segments.reduce((acc, seg) => [...acc, ...seg.points], []);
    const trackStats = calculateTrackStats(allPoints);

    parsedTracks.push({
      name: trk.name || null,
      type: trk.type || null,
      description: trk.desc || null,
      segments,
      points: allPoints,
      stats: trackStats,
      pointCount: allPoints.length,
      segmentCount: segments.length,
    });
  }

  return parsedTracks;
}

function parseTrackSegments(trk) {
  if (!trk.trkseg) return [];
  
  const segments = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];
  const parsedSegments = [];

  for (const seg of segments) {
    const points = parseTrackPoints(seg);
    const segmentStats = calculateSegmentStats(points);

    parsedSegments.push({
      points,
      stats: segmentStats,
      pointCount: points.length,
    });
  }

  return parsedSegments;
}

function parseTrackPoints(seg) {
  if (!seg.trkpt) return [];
  
  const points = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
  const parsedPoints = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const parsedPoint = parsePoint(pt, i);
    if (parsedPoint) {
      parsedPoints.push(parsedPoint);
    }
  }

  return calculateDerivedValues(parsedPoints);
}

function parseWaypoints(gpx) {
  if (!gpx.wpt) return [];
  
  const waypoints = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
  
  return waypoints.map((wpt, i) => ({
    index: i,
    latitude: parseFloat(wpt.lat),
    longitude: parseFloat(wpt.lon),
    elevation: wpt.ele ? parseFloat(wpt.ele) : null,
    time: wpt.time ? toDateTimeString(dayjs(wpt.time)) : null,
    name: wpt.name || null,
    description: wpt.desc || null,
    symbol: wpt.sym || null,
    type: wpt.type || null,
  })).filter(wpt => !isNaN(wpt.latitude) && !isNaN(wpt.longitude));
}

function parsePoint(pt, index) {
  const lat = parseFloat(pt.lat);
  const lon = parseFloat(pt.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const extensions = parseExtensions(pt.extensions);

  return {
    index,
    latitude: lat,
    longitude: lon,
    elevation: pt.ele ? parseFloat(pt.ele) : null,
    time: pt.time ? toDateTimeString(dayjs(pt.time)) : null,
    timestamp: pt.time ? dayjs(pt.time).valueOf() : null,
    heartRate: extensions.heartRate || null,
    cadence: extensions.cadence || null,
    speed: extensions.speed || null,
    temperature: extensions.temperature || null,
    power: extensions.power || null,
    distance: null,
    elapsedTime: null,
    pace: null,
  };
}

function parseExtensions(extensions) {
  const result = {};

  if (!extensions) return result;

  try {
    if (extensions['gpxtpx:TrackPointExtension'] || extensions['ns3:TrackPointExtension']) {
      const ext = extensions['gpxtpx:TrackPointExtension'] || extensions['ns3:TrackPointExtension'];
      
      if (ext['gpxtpx:hr'] || ext['ns3:hr']) {
        result.heartRate = parseInt(ext['gpxtpx:hr'] || ext['ns3:hr'], 10);
      }
      if (ext['gpxtpx:cad'] || ext['ns3:cad']) {
        result.cadence = parseInt(ext['gpxtpx:cad'] || ext['ns3:cad'], 10);
      }
      if (ext['gpxtpx:atemp'] || ext['ns3:atemp']) {
        result.temperature = parseFloat(ext['gpxtpx:atemp'] || ext['ns3:atemp']);
      }
    }

    if (extensions['ns2:TrackPointExtension']) {
      const ext = extensions['ns2:TrackPointExtension'];
      if (ext['ns2:hr']) result.heartRate = parseInt(ext['ns2:hr'], 10);
      if (ext['ns2:cad']) result.cadence = parseInt(ext['ns2:cad'], 10);
    }

    if (extensions.power) {
      result.power = parseInt(extensions.power, 10);
    }

    if (extensions.speed) {
      result.speed = parseFloat(extensions.speed);
    }

  } catch (e) {
    console.warn('Error parsing GPX extensions:', e.message);
  }

  return result;
}

function calculateDerivedValues(points) {
  if (points.length < 2) return points;

  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let prevPoint = null;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (prevPoint) {
      const distance = calculateDistance(
        prevPoint.latitude, prevPoint.longitude,
        point.latitude, point.longitude
      );
      totalDistance += distance;
      point.distance = totalDistance;

      if (prevPoint.elevation !== null && point.elevation !== null) {
        const elevationDiff = point.elevation - prevPoint.elevation;
        if (elevationDiff > 0) {
          totalAscent += elevationDiff;
        } else if (elevationDiff < 0) {
          totalDescent += Math.abs(elevationDiff);
        }
      }

      if (prevPoint.timestamp && point.timestamp) {
        const elapsedMs = point.timestamp - prevPoint.timestamp;
        point.elapsedTime = elapsedMs / 1000;

        if (distance > 0 && elapsedMs > 0) {
          const speedKmh = (distance / (elapsedMs / 1000)) * 3.6;
          const paceMinPerKm = (elapsedMs / 1000 / 60) / distance;

          if (!point.speed) {
            point.speed = speedKmh;
          }
          if (!point.pace) {
            point.pace = paceMinPerKm;
          }
        }
      }
    } else {
      point.distance = 0;
      point.elapsedTime = 0;
    }

    prevPoint = point;
  }

  return points;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function calculateStats(points, metadata) {
  if (!points.length) {
    return {
      totalDistance: 0,
      totalTime: 0,
      movingTime: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      avgPace: 0,
      minPace: 0,
      avgHeartRate: 0,
      maxHeartRate: 0,
      avgCadence: 0,
      maxCadence: 0,
      avgElevation: 0,
      minElevation: 0,
      maxElevation: 0,
      totalAscent: 0,
      totalDescent: 0,
    };
  }

  const lastPoint = points[points.length - 1];
  const totalDistance = lastPoint.distance || 0;

  const validTimes = points.filter(p => p.timestamp);
  let totalTime = 0;
  if (validTimes.length >= 2) {
    totalTime = (validTimes[validTimes.length - 1].timestamp - validTimes[0].timestamp) / 1000;
  }

  const heartRates = points.filter(p => p.heartRate !== null).map(p => p.heartRate);
  const cadences = points.filter(p => p.cadence !== null).map(p => p.cadence);
  const elevations = points.filter(p => p.elevation !== null).map(p => p.elevation);
  const speeds = points.filter(p => p.speed !== null && p.speed > 0).map(p => p.speed);
  const paces = points.filter(p => p.pace !== null && p.pace > 0 && isFinite(p.pace)).map(p => p.pace);

  let totalAscent = 0;
  let totalDescent = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev.elevation !== null && curr.elevation !== null) {
      const diff = curr.elevation - prev.elevation;
      if (diff > 0) totalAscent += diff;
      else if (diff < 0) totalDescent += Math.abs(diff);
    }
  }

  return {
    totalDistance,
    totalTime,
    movingTime: totalTime,
    avgSpeed: speeds.length ? _.mean(speeds) : 0,
    maxSpeed: speeds.length ? Math.max(...speeds) : 0,
    avgPace: paces.length ? _.mean(paces) : 0,
    minPace: paces.length ? Math.min(...paces) : 0,
    avgHeartRate: heartRates.length ? _.round(_.mean(heartRates), 0) : 0,
    maxHeartRate: heartRates.length ? Math.max(...heartRates) : 0,
    avgCadence: cadences.length ? _.round(_.mean(cadences), 0) : 0,
    maxCadence: cadences.length ? Math.max(...cadences) : 0,
    avgElevation: elevations.length ? _.round(_.mean(elevations), 1) : 0,
    minElevation: elevations.length ? Math.min(...elevations) : 0,
    maxElevation: elevations.length ? Math.max(...elevations) : 0,
    totalAscent,
    totalDescent,
  };
}

function calculateTrackStats(points) {
  return calculateStats(points, {});
}

function calculateSegmentStats(points) {
  return calculateStats(points, {});
}

module.exports = {
  parseGPX,
  calculateDistance,
};
