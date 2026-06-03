export function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function grahamScan(points) {
  if (points.length < 3) return { hull: points, issues: [] };

  const issues = [];
  const uniquePoints = [];
  const seen = new Set();

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) {
      issues.push({
        type: 'duplicate',
        message: `发现重复坐标: (${p.x}, ${p.y})，第${i + 1}点与之前重复`,
        point: p,
        index: i
      });
    } else {
      seen.add(key);
      uniquePoints.push({ ...p, originalIndex: i });
    }
  }

  if (uniquePoints.length < 3) {
    return { hull: uniquePoints, issues: [...issues, { type: 'insufficient', message: '有效坐标点不足3个，无法构成多边形' }] };
  }

  const sorted = [...uniquePoints].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  const direction = checkWindingOrder(uniquePoints);
  if (direction !== 'counter-clockwise') {
    issues.push({
      type: 'winding',
      message: `坐标顺序为${direction === 'clockwise' ? '顺时针' : '无法判断'}，标准应为逆时针`,
      expected: 'counter-clockwise',
      actual: direction
    });
  }

  const isConvex = isPolygonConvex(uniquePoints);
  if (isConvex) {
    return { hull: uniquePoints, issues, rawPoints: points };
  }

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      const removed = lower.pop();
      if (cross(lower[lower.length - 1], removed, p) < 0) {
        issues.push({
          type: 'concave',
          message: `发现凹点: (${removed.x}, ${removed.y}) 位于多边形凹处`,
          point: removed,
          index: removed.originalIndex
        });
      }
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      const removed = upper.pop();
      if (cross(upper[upper.length - 1], removed, p) < 0 && !issues.find(iss => iss.point?.x === removed.x && iss.point?.y === removed.y)) {
        issues.push({
          type: 'concave',
          message: `发现凹点: (${removed.x}, ${removed.y}) 位于多边形凹处`,
          point: removed,
          index: removed.originalIndex
        });
      }
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];

  const hullDirection = checkWindingOrder(hull);
  if (hullDirection !== 'counter-clockwise' && !issues.find(i => i.type === 'winding')) {
    issues.push({
      type: 'winding',
      message: `坐标顺序为${hullDirection === 'clockwise' ? '顺时针' : '无法判断'}，标准应为逆时针`,
      expected: 'counter-clockwise',
      actual: hullDirection
    });
  }

  return { hull, issues, rawPoints: points };
}

export function isPolygonConvex(points) {
  if (points.length < 3) return true;

  const n = points.length;
  let sign = 0;

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const c = points[(i + 2) % n];

    const cr = cross(a, b, c);
    if (cr !== 0) {
      if (sign === 0) {
        sign = cr > 0 ? 1 : -1;
      } else if ((cr > 0 && sign < 0) || (cr < 0 && sign > 0)) {
        return false;
      }
    }
  }

  return true;
}

export function checkWindingOrder(points) {
  if (points.length < 3) return 'unknown';

  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }

  if (sum < 0) return 'counter-clockwise';
  if (sum > 0) return 'clockwise';
  return 'collinear';
}

export function polygonArea(points) {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

export function findProblemEdges(points, issues) {
  const problemEdges = [];
  const concavePoints = issues.filter(i => i.type === 'concave').map(i => i.point);

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const hasConcave = concavePoints.some(p =>
      (p.x === p1.x && p.y === p1.y) || (p.x === p2.x && p.y === p2.y)
    );

    if (hasConcave) {
      problemEdges.push({
        start: p1,
        end: p2,
        type: 'concave-edge',
        message: '此边包含凹点，属于问题边'
      });
    }
  }

  return problemEdges;
}

export function analyzeGeometry(studentAnswer) {
  const points = studentAnswer.points || [];

  const { hull, issues } = grahamScan(points);
  const rawArea = polygonArea(points);
  const convexArea = polygonArea(hull);
  const convex = isPolygonConvex(points);
  const concaveIssues = !convex ? detectConcavePoints(points) : [];
  const allIssues = [...issues.filter(i => i.type !== 'concave' && i.type !== 'convex-check'), ...concaveIssues];
  const problemEdges = findProblemEdges(points, concaveIssues);

  return {
    rawPoints: points,
    convexHull: hull,
    rawArea,
    convexArea,
    areaDiff: convexArea - rawArea,
    areaDiffRatio: rawArea > 0 ? (convexArea - rawArea) / rawArea : 0,
    issues: allIssues,
    problemEdges,
    isConvex: convex,
    windingOrder: checkWindingOrder(points)
  };
}

export function detectConcavePoints(points) {
  if (points.length < 3) return [];

  const issues = [];
  const n = points.length;
  const winding = checkWindingOrder(points);
  const expectedSign = winding === 'counter-clockwise' ? 1 : -1;

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const c = points[(i + 2) % n];

    const cr = cross(a, b, c);
    if (winding !== 'collinear' && cr * expectedSign < -0.0001) {
      issues.push({
        type: 'concave',
        message: `发现凹点: (${b.x}, ${b.y}) 位于多边形凹处`,
        point: b,
        index: (i + 1) % n
      });
    }
  }

  return issues;
}
