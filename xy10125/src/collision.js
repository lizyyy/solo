export function getRotatedRectangleCorners(x, y, width, length, angle) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = x + width / 2;
  const cy = y + length / 2;
  const hw = width / 2;
  const hl = length / 2;

  const corners = [
    { x: -hw, y: -hl },
    { x: hw, y: -hl },
    { x: hw, y: hl },
    { x: -hw, y: hl }
  ];

  return corners.map(c => ({
    x: cx + c.x * cos - c.y * sin,
    y: cy + c.x * sin + c.y * cos
  }));
}

function getAxes(corners) {
  const axes = [];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    axes.push({ x: -edge.y, y: edge.x });
  }
  return axes;
}

function normalize(axis) {
  const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
  return { x: axis.x / len, y: axis.y / len };
}

function project(corners, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const proj = c.x * axis.x + c.y * axis.y;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return { min, max };
}

function overlap(p1, p2) {
  return !(p1.max < p2.min || p2.max < p1.min);
}

export function rectanglesCollide(rect1, rect2) {
  const c1 = getRotatedRectangleCorners(
    rect1.x, rect1.y, rect1.width, rect1.length, rect1.angle || 0
  );
  const c2 = getRotatedRectangleCorners(
    rect2.x, rect2.y, rect2.width, rect2.length, rect2.angle || 0
  );

  const axes = [...getAxes(c1), ...getAxes(c2)];

  for (const axis of axes) {
    const normalized = normalize(axis);
    const p1 = project(c1, normalized);
    const p2 = project(c2, normalized);
    if (!overlap(p1, p2)) return false;
  }
  return true;
}

export function circleRectangleCollide(circle, rect) {
  const corners = getRotatedRectangleCorners(
    rect.x, rect.y, rect.width, rect.length, rect.angle || 0
  );

  const rad = (rect.angle || 0) * Math.PI / 180;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.length / 2;

  const localX = (circle.x - cx) * cos - (circle.y - cy) * sin;
  const localY = (circle.x - cx) * sin + (circle.y - cy) * cos;

  const hw = rect.width / 2;
  const hl = rect.length / 2;

  const closestX = Math.max(-hw, Math.min(hw, localX));
  const closestY = Math.max(-hl, Math.min(hl, localY));

  const dx = localX - closestX;
  const dy = localY - closestY;

  return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

export function pointInRectangle(px, py, rect) {
  const corners = getRotatedRectangleCorners(
    rect.x, rect.y, rect.width, rect.length, rect.angle || 0
  );

  let inside = true;
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const normal = { x: -edge.y, y: edge.x };
    const toPoint = { x: px - p1.x, y: py - p1.y };
    const dot = normal.x * toPoint.x + normal.y * toPoint.y;
    if (dot < 0) {
      inside = false;
      break;
    }
  }
  return inside;
}

export function detectCollisions(objects) {
  const collisions = [];

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];

      if (a.type === 'turningRadius' || b.type === 'turningRadius') {
        const circle = a.type === 'turningRadius' ? a : b;
        const rect = a.type === 'turningRadius' ? b : a;

        if (rect.type === 'turningRadius') {
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < a.radius + b.radius) {
            collisions.push({
              type: 'collision',
              objectA: a,
              objectB: b,
              message: `${a.label} 与 ${b.label} 重叠`
            });
          }
        } else {
          const circleData = { x: circle.x, y: circle.y, radius: circle.radius };
          if (circleRectangleCollide(circleData, rect.getBounds())) {
            collisions.push({
              type: 'collision',
              objectA: a,
              objectB: b,
              message: `${a.label} 与 ${b.label} 重叠`
            });
          }
        }
      } else {
        if (rectanglesCollide(a.getBounds(), b.getBounds())) {
          collisions.push({
            type: 'collision',
            objectA: a,
            objectB: b,
            message: `${a.label} 与 ${b.label} 重叠`
          });
        }
      }
    }
  }

  return collisions;
}

export function detectFireLaneViolations(objects) {
  const violations = [];
  const fireLanes = objects.filter(o => o.type === 'fireLane');
  const parkingSpots = objects.filter(o => o.type === 'parking');

  for (const lane of fireLanes) {
    for (const spot of parkingSpots) {
      if (rectanglesCollide(lane.getBounds(), spot.getBounds())) {
        violations.push({
          type: 'fireLane',
          objectA: lane,
          objectB: spot,
          message: `泊位 ${spot.label} 占用消防通道 ${lane.label}`
        });
      }
    }
  }

  return violations;
}

export function detectTurningRadiusViolations(objects) {
  const violations = [];
  const turningAreas = objects.filter(o => o.type === 'turningRadius');
  const parkingSpots = objects.filter(o => o.type === 'parking');

  for (const ta of turningAreas) {
    for (const spot of parkingSpots) {
      const circleData = { x: ta.x, y: ta.y, radius: ta.radius };
      if (circleRectangleCollide(circleData, spot.getBounds())) {
        violations.push({
          type: 'turningRadius',
          objectA: ta,
          objectB: spot,
          message: `泊位 ${spot.label} 侵入转弯区域 ${ta.label}`
        });
      }
    }
  }

  return violations;
}

export function detectAllAnomalies(objects, boundary = null) {
  const anomalies = [];

  anomalies.push(...detectCollisions(objects));
  anomalies.push(...detectFireLaneViolations(objects));
  anomalies.push(...detectTurningRadiusViolations(objects));

  if (boundary) {
    for (const obj of objects) {
      if (obj.type === 'parking') {
        const bounds = obj.getBounds();
        const corners = getRotatedRectangleCorners(
          bounds.x, bounds.y, bounds.width, bounds.length, bounds.angle
        );
        for (const corner of corners) {
          if (
            corner.x < boundary.minX ||
            corner.x > boundary.maxX ||
            corner.y < boundary.minY ||
            corner.y > boundary.maxY
          ) {
            anomalies.push({
              type: 'boundary',
              object: obj,
              message: `泊位 ${obj.label} 超出边界`
            });
            break;
          }
        }
      }
    }
  }

  return anomalies;
}
