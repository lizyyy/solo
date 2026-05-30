import { Vector2D, TrackElement, TrajectoryPoint, TRACK_WIDTH, TrackElementType } from '../../types';

export interface TrackSegment {
  start: Vector2D;
  end: Vector2D;
  element: TrackElement;
}

export function getTrackCenterline(element: TrackElement): TrackSegment[] {
  const { x, y, rotation, type, width, height } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  function rotatePoint(px: number, py: number): Vector2D {
    const localX = px - width / 2;
    const localY = py - height / 2;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos
    };
  }

  const segments: TrackSegment[] = [];

  switch (type) {
    case 'straight':
      segments.push({
        start: rotatePoint(0, height / 2),
        end: rotatePoint(width, height / 2),
        element
      });
      break;
    case 'curve-left': {
      const steps = 20;
      const radius = Math.min(width, height);
      const center = rotatePoint(width, 0);
      for (let i = 0; i < steps; i++) {
        const angle1 = (Math.PI / 2) * (1 - i / steps);
        const angle2 = (Math.PI / 2) * (1 - (i + 1) / steps);
        segments.push({
          start: {
            x: center.x + radius * Math.cos(angle1),
            y: center.y + radius * Math.sin(angle1)
          },
          end: {
            x: center.x + radius * Math.cos(angle2),
            y: center.y + radius * Math.sin(angle2)
          },
          element
        });
      }
      break;
    }
    case 'curve-right': {
      const steps = 20;
      const radius = Math.min(width, height);
      const center = rotatePoint(0, 0);
      for (let i = 0; i < steps; i++) {
        const angle1 = Math.PI - (Math.PI / 2) * (i / steps);
        const angle2 = Math.PI - (Math.PI / 2) * ((i + 1) / steps);
        segments.push({
          start: {
            x: center.x + radius * Math.cos(angle1),
            y: center.y + radius * Math.sin(angle1)
          },
          end: {
            x: center.x + radius * Math.cos(angle2),
            y: center.y + radius * Math.sin(angle2)
          },
          element
        });
      }
      break;
    }
    case 'start':
    case 'end':
      segments.push({
        start: rotatePoint(0, height / 2),
        end: rotatePoint(width, height / 2),
        element
      });
      break;
  }

  return segments;
}

export function distanceToSegment(point: Vector2D, start: Vector2D, end: Vector2D): number {
  const A = point.x - start.x;
  const B = point.y - start.y;
  const C = end.x - start.x;
  const D = end.y - start.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;

  let xx: number, yy: number;

  if (param < 0) {
    xx = start.x;
    yy = start.y;
  } else if (param > 1) {
    xx = end.x;
    yy = end.y;
  } else {
    xx = start.x + param * C;
    yy = start.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceToTrack(position: Vector2D, trackElements: TrackElement[]): {
  distance: number;
  nearestElement: TrackElement | null;
  nearestSegment: TrackSegment | null;
} {
  let minDistance = Infinity;
  let nearestElement: TrackElement | null = null;
  let nearestSegment: TrackSegment | null = null;

  for (const element of trackElements) {
    const segments = getTrackCenterline(element);
    for (const segment of segments) {
      const dist = distanceToSegment(position, segment.start, segment.end);
      if (dist < minDistance) {
        minDistance = dist;
        nearestElement = element;
        nearestSegment = segment;
      }
    }
  }

  return { distance: minDistance, nearestElement, nearestSegment };
}

export function isPointInTrack(position: Vector2D, trackElements: TrackElement[]): boolean {
  const { distance } = distanceToTrack(position, trackElements);
  return distance <= TRACK_WIDTH / 2;
}

export function checkTrackCollision(point: TrajectoryPoint, trackElements: TrackElement[]): {
  collision: boolean;
  point: Vector2D | null;
  distance: number;
} {
  const { distance } = distanceToTrack(point.position, trackElements);

  if (distance > TRACK_WIDTH / 2) {
    return {
      collision: true,
      point: { ...point.position },
      distance
    };
  }

  return {
    collision: false,
    point: null,
    distance
  };
}

export function findStartElement(trackElements: TrackElement[]): TrackElement | undefined {
  return trackElements.find(el => el.type === 'start');
}

export function findEndElement(trackElements: TrackElement[]): TrackElement | undefined {
  return trackElements.find(el => el.type === 'end');
}

export function checkSuccess(point: TrajectoryPoint, endElement: TrackElement | undefined): boolean {
  if (!endElement) return false;

  const { x, y, width, height } = endElement;
  const endCenter = {
    x: x + width / 2,
    y: y + height / 2
  };

  const distToEnd = Math.sqrt(
    Math.pow(point.position.x - endCenter.x, 2) +
    Math.pow(point.position.y - endCenter.y, 2)
  );

  return distToEnd < TRACK_WIDTH;
}

export function checkTrackContinuity(trackElements: TrackElement[]): {
  isContinuous: boolean;
  brokenPoints: Vector2D[];
} {
  const startElement = findStartElement(trackElements);
  const endElement = findEndElement(trackElements);

  if (!startElement || !endElement) {
    return {
      isContinuous: false,
      brokenPoints: []
    };
  }

  const threshold = TRACK_WIDTH / 2;
  const allSegments: TrackSegment[] = [];

  for (const element of trackElements) {
    allSegments.push(...getTrackCenterline(element));
  }

  const brokenPoints: Vector2D[] = [];

  for (let i = 0; i < allSegments.length; i++) {
    const seg1 = allSegments[i];
    let hasConnection = false;

    for (let j = 0; j < allSegments.length; j++) {
      if (i === j) continue;
      const seg2 = allSegments[j];

      const d1 = distanceToSegment(seg1.end, seg2.start, seg2.end);
      const d2 = distanceToSegment(seg1.start, seg2.start, seg2.end);

      if (d1 < threshold || d2 < threshold) {
        hasConnection = true;
        break;
      }
    }

    if (!hasConnection && seg1.element.type !== 'start' && seg1.element.type !== 'end') {
      const midPoint = {
        x: (seg1.start.x + seg1.end.x) / 2,
        y: (seg1.start.y + seg1.end.y) / 2
      };
      brokenPoints.push(midPoint);
    }
  }

  return {
    isContinuous: brokenPoints.length === 0,
    brokenPoints
  };
}
