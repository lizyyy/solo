import { VisitorTrajectory, Showcase, AnomalyReport, Position3D } from '../data/types';

const BREAK_TIME_THRESHOLD = 5000;
const BREAK_DISTANCE_THRESHOLD = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const CONGESTION_VISITOR_THRESHOLD = 3;

export function detectTrajectoryBreaks(trajectories: VisitorTrajectory[]): AnomalyReport[] {
  const anomalies: AnomalyReport[] = [];

  trajectories.forEach((traj) => {
    for (let i = 1; i < traj.points.length; i++) {
      const prev = traj.points[i - 1];
      const curr = traj.points[i];
      
      const timeDiff = curr.timestamp - prev.timestamp;
      const distance = calculateDistance(prev.position, curr.position);
      
      if (timeDiff > BREAK_TIME_THRESHOLD || distance > BREAK_DISTANCE_THRESHOLD) {
        anomalies.push({
          type: 'trajectory_break',
          severity: timeDiff > BREAK_TIME_THRESHOLD * 2 ? 'high' : 'medium',
          message: `观众 ${traj.visitorId} 在 ${formatTime(curr.timestamp)} 处轨迹中断`,
          location: curr.position,
          visitorId: traj.visitorId,
        });
      }

      if (curr.confidence < LOW_CONFIDENCE_THRESHOLD) {
        anomalies.push({
          type: 'trajectory_break',
          severity: 'low',
          message: `观众 ${traj.visitorId} 轨迹点置信度较低`,
          location: curr.position,
          visitorId: traj.visitorId,
        });
      }
    }
  });

  return anomalies;
}

export function detectShowcaseMismatch(
  trajectories: VisitorTrajectory[],
  showcases: Showcase[]
): AnomalyReport[] {
  const anomalies: AnomalyReport[] = [];
  const showcaseMap = new Map(showcases.map(s => [s.id, s]));

  trajectories.forEach((traj) => {
    traj.stays.forEach((stay) => {
      const showcase = showcaseMap.get(stay.showcaseId);
      if (!showcase) {
        anomalies.push({
          type: 'showcase_mismatch',
          severity: 'high',
          message: `展柜编号 ${stay.showcaseId} 不存在于展厅布局中`,
          showcaseId: stay.showcaseId,
        });
        return;
      }

      const stayPoints = traj.points.filter(
        (p) => p.timestamp >= stay.startTime && p.timestamp <= stay.startTime + stay.duration
      );
      
      if (stayPoints.length > 0) {
        const avgPosition = calculateAveragePosition(stayPoints.map(p => p.position));
        const distance = calculateDistance(avgPosition, showcase.position);
        
        if (distance > 2) {
          anomalies.push({
            type: 'showcase_mismatch',
            severity: 'medium',
            message: `观众 ${traj.visitorId} 在展柜 ${showcase.number} 的停留位置偏差过大 (${distance.toFixed(2)}m)`,
            location: avgPosition,
            visitorId: traj.visitorId,
            showcaseId: stay.showcaseId,
          });
        }
      }
    });
  });

  return anomalies;
}

export function detectCongestionConfusion(
  trajectories: VisitorTrajectory[],
  showcases: Showcase[]
): AnomalyReport[] {
  const anomalies: AnomalyReport[] = [];
  const timeWindow = 10000;

  showcases.forEach((showcase) => {
    const showcaseStays = trajectories.flatMap((traj) =>
      traj.stays
        .filter((stay) => stay.showcaseId === showcase.id)
        .map((stay) => ({
          visitorId: traj.visitorId,
          startTime: stay.startTime,
          endTime: stay.startTime + stay.duration,
          isCongestion: stay.isCongestion,
        }))
    );

    showcaseStays.forEach((stay, idx) => {
      const concurrentStays = showcaseStays.filter(
        (s, i) =>
          i !== idx &&
          Math.abs(s.startTime - stay.startTime) < timeWindow
      );

      const shouldBeCongestion = concurrentStays.length >= CONGESTION_VISITOR_THRESHOLD;
      
      if (shouldBeCongestion && !stay.isCongestion) {
        anomalies.push({
          type: 'congestion_confusion',
          severity: 'medium',
          message: `展柜 ${showcase.number} 在 ${formatTime(stay.startTime)} 可能存在拥堵但未标记`,
          location: showcase.position,
          showcaseId: showcase.id,
        });
      }
      
      if (!shouldBeCongestion && stay.isCongestion) {
        anomalies.push({
          type: 'congestion_confusion',
          severity: 'low',
          message: `展柜 ${showcase.number} 拥堵标记可能误判`,
          location: showcase.position,
          showcaseId: showcase.id,
        });
      }
    });
  });

  return anomalies;
}

export function validateAllData(
  trajectories: VisitorTrajectory[],
  showcases: Showcase[]
): AnomalyReport[] {
  return [
    ...detectTrajectoryBreaks(trajectories),
    ...detectShowcaseMismatch(trajectories, showcases),
    ...detectCongestionConfusion(trajectories, showcases),
  ];
}

function calculateDistance(a: Position3D, b: Position3D): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));
}

function calculateAveragePosition(positions: Position3D[]): Position3D {
  const sum = positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length,
    z: sum.z / positions.length,
  };
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getHeatmapData(
  trajectories: VisitorTrajectory[],
  currentTime: number,
  showcases: Showcase[]
): Array<{ position: Position3D; intensity: number; showcaseId?: string }> {
  const heatPoints: Array<{ position: Position3D; intensity: number; showcaseId?: string }> = [];

  showcases.forEach((showcase) => {
    const totalDuration = trajectories.reduce((sum, traj) => {
      const relevantStays = traj.stays.filter(
        (s) => s.showcaseId === showcase.id && s.startTime <= currentTime
      );
      return sum + relevantStays.reduce((s, stay) => s + Math.min(stay.duration, currentTime - stay.startTime), 0);
    }, 0);

    const intensity = Math.min(totalDuration / 60000, 1);
    if (intensity > 0.1) {
      heatPoints.push({
        position: showcase.position,
        intensity,
        showcaseId: showcase.id,
      });
    }
  });

  trajectories.forEach((traj) => {
    const relevantPoints = traj.points.filter(
      (p) => p.timestamp <= currentTime && p.timestamp >= currentTime - 30000
    );
    relevantPoints.forEach((point) => {
      const existing = heatPoints.find(
        (h) => calculateDistance(h.position, point.position) < 1
      );
      if (!existing) {
        heatPoints.push({
          position: { ...point.position, y: 0.1 },
          intensity: 0.3,
        });
      }
    });
  });

  return heatPoints;
}

export function getShowcaseStats(
  trajectories: VisitorTrajectory[],
  showcases: Showcase[]
): Array<{ showcaseId: string; visitorCount: number; avgDuration: number; totalDuration: number }> {
  return showcases.map((showcase) => {
    const stays = trajectories.flatMap((traj) =>
      traj.stays.filter((s) => s.showcaseId === showcase.id)
    );
    
    return {
      showcaseId: showcase.id,
      visitorCount: stays.length,
      avgDuration: stays.length > 0 ? stays.reduce((s, st) => s + st.duration, 0) / stays.length : 0,
      totalDuration: stays.reduce((s, st) => s + st.duration, 0),
    };
  });
}
