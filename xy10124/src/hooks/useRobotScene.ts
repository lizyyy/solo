import { useEffect, useRef, useCallback } from 'react';
import { SceneManager } from '../scene/SceneManager';
import { RobotArm } from '../robot/RobotArm';
import { CollisionDetector } from '../collision/CollisionDetector';
import { ProjectConfig, JointState, AnalysisResult, Anomaly, AnomalyType, Trajectory, TrajectoryPoint } from '../types';

export function useRobotScene(containerRef: React.RefObject<HTMLDivElement>) {
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const robotArmRef = useRef<RobotArm | null>(null);
  const collisionDetectorRef = useRef<CollisionDetector | null>(null);
  const obstacleMeshesRef = useRef<Map<string, any>>(new Map());
  const trajectoryLineRef = useRef<any>(null);

  const initScene = useCallback((config: ProjectConfig) => {
    if (!containerRef.current) return;

    if (sceneManagerRef.current) {
      sceneManagerRef.current.dispose();
    }

    const sceneManager = new SceneManager(containerRef.current);
    sceneManagerRef.current = sceneManager;

    const robotArm = new RobotArm();
    robotArmRef.current = robotArm;
    sceneManager.addToScene(robotArm.getMesh());

    const collisionDetector = new CollisionDetector(config);
    collisionDetectorRef.current = collisionDetector;

    collisionDetector.getObstacleMeshes().forEach((mesh) => {
      sceneManager.addToScene(mesh);
    });
  }, [containerRef]);

  const updateRobotPose = useCallback((jointState: JointState) => {
    if (robotArmRef.current) {
      robotArmRef.current.setJointAngles(jointState);
    }
  }, []);

  const getEndEffectorPose = useCallback(() => {
    if (robotArmRef.current) {
      return robotArmRef.current.getEndEffectorPose();
    }
    return null;
  }, []);

  const getEndEffectorPosition = useCallback(() => {
    if (robotArmRef.current) {
      return robotArmRef.current.getEndEffectorPosition();
    }
    return null;
  }, []);

  const checkCollisionForPoint = useCallback(
    (point: TrajectoryPoint, pointIndex: number) => {
      if (!collisionDetectorRef.current || !robotArmRef.current) {
        return { hasCollision: false, distance: -1, anomalies: [] };
      }

      const armBoxes = robotArmRef.current.getBoundingBoxes();
      const eePos = robotArmRef.current.getEndEffectorPosition();

      return collisionDetectorRef.current.checkPoint(point, armBoxes, eePos, pointIndex);
    },
    []
  );

  const analyzeTrajectory = useCallback(
    (trajectory: Trajectory, config: ProjectConfig): AnalysisResult => {
      if (!collisionDetectorRef.current || !robotArmRef.current) {
        return {
          trajectoryId: trajectory.id,
          analyzedAt: Date.now(),
          totalPoints: trajectory.points.length,
          safePoints: 0,
          collisionCount: 0,
          nearMissCount: 0,
          boundaryViolationCount: 0,
          anomalies: [],
          minDistanceToObstacles: Infinity
        };
      }

      collisionDetectorRef.current.updateObstacles(config.obstacles);
      collisionDetectorRef.current.updateSafetyMargin(config.safetyMargin);

      const allAnomalies: Anomaly[] = [];
      let minDistance = Infinity;
      let collisionCount = 0;
      let nearMissCount = 0;
      let boundaryViolationCount = 0;

      trajectory.points.forEach((point, index) => {
        robotArmRef.current!.setJointAngles(point.joints);

        const result = checkCollisionForPoint(point, index);

        if (result.distance > 0 && result.distance < minDistance) {
          minDistance = result.distance;
        }

        if (result.anomalies.length > 0) {
          result.anomalies.forEach((anomaly) => {
            allAnomalies.push(anomaly);
            if (anomaly.type === AnomalyType.COLLISION) collisionCount++;
            else if (anomaly.type === AnomalyType.NEAR_MISS) nearMissCount++;
            else if (anomaly.type === AnomalyType.BOUNDARY_VIOLATION) boundaryViolationCount++;
          });
        }
      });

      const safePoints = trajectory.points.length - allAnomalies.filter((a) => 
        a.type === AnomalyType.COLLISION || a.type === AnomalyType.BOUNDARY_VIOLATION
      ).length;

      return {
        trajectoryId: trajectory.id,
        analyzedAt: Date.now(),
        totalPoints: trajectory.points.length,
        safePoints,
        collisionCount,
        nearMissCount,
        boundaryViolationCount,
        anomalies: allAnomalies,
        minDistanceToObstacles: minDistance === Infinity ? -1 : minDistance
      };
    },
    [checkCollisionForPoint]
  );

  const setRobotHighlight = useCallback((highlighted: boolean) => {
    if (robotArmRef.current) {
      robotArmRef.current.setHighlighted(highlighted);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
      }
    };
  }, []);

  return {
    initScene,
    updateRobotPose,
    getEndEffectorPose,
    getEndEffectorPosition,
    checkCollisionForPoint,
    analyzeTrajectory,
    setRobotHighlight
  };
}
