import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import type { LevelConfig, Vec3 } from "@/types/game";
import {
  checkCraneCollision,
  computeTilt,
  segmentIntersectsZone,
} from "@/utils/physics";

interface LiftPlan {
  level: LevelConfig;
  coilId: string;
  zoneId: string;
  craneId: string;
}

interface Phase {
  name: "move-over" | "lower" | "lift" | "travel" | "drop" | "done";
  startPos: Vec3;
  endPos: Vec3;
  duration: number;
}

export function useGameEngine() {
  const level = useGameStore((s) => s.currentLevel);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setStatus = useGameStore((s) => s.setStatus);
  const setCranePosition = useGameStore((s) => s.setCranePosition);
  const setCoilPosition = useGameStore((s) => s.setCoilPosition);
  const currentCoilId = useGameStore((s) => s.currentCoilId);
  const setCurrentCoilId = (id: string | null) => {
    useGameStore.setState({ currentCoilId: id });
  };
  const failSession = useGameStore((s) => s.failSession);
  const succeedSession = useGameStore((s) => s.succeedSession);
  const tickTime = useGameStore((s) => s.tickTime);
  const pushEvent = useGameStore((s) => s.pushEvent);
  const pushSnapshot = useGameStore((s) => s.pushSnapshot);
  const session = useGameStore((s) => s.session);
  const status = useGameStore((s) => s.status);

  const plansRef = useRef<Phase[]>([]);
  const planIdxRef = useRef(0);
  const phaseProgressRef = useRef(0);
  const planRef = useRef<LiftPlan | null>(null);
  const lastTimeRef = useRef<number>(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!level) return;
    let rafId: number;

    const loop = (t: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = t;
      const dt = Math.min(0.05, (t - lastTimeRef.current) / 1000);
      lastTimeRef.current = t;

      const s = useGameStore.getState();
      if (s.status === "running" && runningRef.current) {
        tickTime(dt);
        stepEngine(dt);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const stepEngine = (dt: number) => {
    const s = useGameStore.getState();
    if (!s.currentLevel || !planRef.current) return;

    const plans = plansRef.current;
    if (planIdxRef.current >= plans.length) {
      finishLift();
      return;
    }

    const phase = plans[planIdxRef.current];
    phaseProgressRef.current += dt / phase.duration;
    const t = Math.min(1, phaseProgressRef.current);
    const eased = easeInOut(t);

    const craneId = planRef.current.craneId;
    const crane = s.currentLevel.cranes.find((c) => c.id === craneId);
    if (!crane) return;

    const newX = lerp(phase.startPos.x, phase.endPos.x, eased);
    const newY = lerp(phase.startPos.y, phase.endPos.y, eased);
    const newZ = lerp(phase.startPos.z, phase.endPos.z, eased);
    setCranePosition(craneId, { x: newX, y: newY, z: newZ });

    if (phase.name === "lower" || phase.name === "lift" || phase.name === "travel" || phase.name === "drop") {
      const coilId = planRef.current.coilId;
      const coil = s.currentLevel.coils.find((c) => c.id === coilId);
      if (coil) {
        const currentPos = s.coilPositions[coilId];
        if (phase.name === "travel") {
          const liftY = 3.5;
          setCoilPosition(coilId, {
            ...currentPos,
            x: newX,
            y: liftY,
            z: newZ,
            tilt: currentPos.tilt,
            tiltAxis: currentPos.tiltAxis,
          });
        } else if (phase.name === "lower") {
          const liftY = 3.5;
          const targetY = coil.position.y;
          const y = lerp(liftY, targetY, eased);
          setCoilPosition(coilId, {
            ...currentPos,
            x: newX,
            y,
            z: newZ,
          });
        } else if (phase.name === "lift") {
          const y = lerp(coil.position.y, 3.5, eased);
          setCoilPosition(coilId, {
            ...currentPos,
            x: newX,
            y,
            z: newZ,
          });
        } else if (phase.name === "drop") {
          const y = lerp(3.5, coil.position.y, eased);
          setCoilPosition(coilId, {
            ...currentPos,
            x: newX,
            y,
            z: newZ,
          });
        }
      }
    }

    if (phase.name === "travel") {
      checkTravelCollisions(newX, newZ);
    }

    if (t >= 1) {
      advancePhase();
    }
  };

  const advancePhase = () => {
    phaseProgressRef.current = 0;
    planIdxRef.current += 1;
    const plans = plansRef.current;
    if (planIdxRef.current < plans.length) {
      const next = plans[planIdxRef.current];
      if (next.name === "lift") setPhase("lifting");
      else if (next.name === "travel") setPhase("moving");
      else if (next.name === "lower" || next.name === "drop") setPhase("lowering");
    }
    snapRecord();
  };

  const checkTravelCollisions = (x: number, z: number) => {
    const s = useGameStore.getState();
    if (!s.currentLevel || !planRef.current) return;
    const coilId = planRef.current.coilId;
    const coil = s.currentLevel.coils.find((c) => c.id === coilId);
    if (!coil) return;

    const liftY = 3.5;
    for (const zone of s.currentLevel.zones) {
      if (zone.type === "personnel") {
        if (segmentIntersectsZone(
          { x: s.cranePositions[planRef.current.craneId].x, y: liftY, z: s.cranePositions[planRef.current.craneId].z },
          { x, y: liftY, z },
          zone,
          0.8,
        )) {
          pushEvent({
            type: "personnel_cross",
            severity: "critical",
            detail: `吊运穿越人行通道：${zone.label || zone.id}`,
            frame: s.session?.totalFrames || 0,
            time: Date.now(),
            position: { x, y: liftY, z },
          });
          failSession("personnel_cross", `吊运穿越人行通道：${zone.label || zone.id}`);
          runningRef.current = false;
          return;
        }
      } else if (zone.type === "restricted") {
        if (segmentIntersectsZone(
          { x: s.cranePositions[planRef.current.craneId].x, y: liftY, z: s.cranePositions[planRef.current.craneId].z },
          { x, y: liftY, z },
          zone,
          0.6,
        )) {
          pushEvent({
            type: "zone_collision",
            severity: "critical",
            detail: `吊运进入禁入区：${zone.label || zone.id}`,
            frame: s.session?.totalFrames || 0,
            time: Date.now(),
            position: { x, y: liftY, z },
          });
          failSession("zone_collision", `吊运进入禁入区：${zone.label || zone.id}`);
          runningRef.current = false;
          return;
        }
      }
    }

    for (const otherCrane of s.currentLevel.cranes) {
      if (otherCrane.id === planRef.current.craneId) continue;
      const otherPos = s.cranePositions[otherCrane.id];
      if (!otherPos) continue;
      const myPos = { x, z };
      const collision = checkCraneCollision(
        s.currentLevel.cranes.find((c) => c.id === planRef.current.craneId)!,
        myPos,
        otherCrane,
        { x: otherPos.x, z: otherPos.z },
        2.5,
      );
      if (collision.collided) {
        pushEvent({
          type: "rail_conflict",
          severity: "critical",
          detail: `行车冲突：${collision.a} 与 ${collision.b} 距离过近`,
          frame: s.session?.totalFrames || 0,
          time: Date.now(),
        });
        failSession("rail_conflict", `行车冲突：距离 ${collision.distance.toFixed(2)}m 小于安全距离`);
        runningRef.current = false;
        return;
      }
    }
  };

  const finishLift = () => {
    const s = useGameStore.getState();
    if (!s.currentLevel || !planRef.current) return;
    const coilId = planRef.current.coilId;
    const coil = s.currentLevel.coils.find((c) => c.id === coilId);
    const zone = s.currentLevel.zones.find((z) => z.id === planRef.current!.zoneId);
    if (!coil || !zone) return;

    if (zone.type !== "dropoff") {
      pushEvent({
        type: "wrong_zone",
        severity: "critical",
        detail: `目标区域非放卷区：${zone.label || zone.id}`,
        frame: s.session?.totalFrames || 0,
        time: Date.now(),
      });
      failSession("wrong_zone", "目标区域非放卷区");
      runningRef.current = false;
      return;
    }

    if (coil.targetZoneId !== zone.id) {
      pushEvent({
        type: "wrong_zone",
        severity: "warning",
        detail: `钢卷未放在指定目标区`,
        frame: s.session?.totalFrames || 0,
        time: Date.now(),
      });
    }

    setCoilPosition(coilId, {
      ...s.coilPositions[coilId],
      delivered: true,
      tilt: 0,
      tiltAxis: { x: 1, y: 0 },
    });

    pushEvent({
      type: "success",
      severity: "success",
      detail: `钢卷 ${coilId} 成功吊运至 ${zone.label || zone.id}`,
      frame: s.session?.totalFrames || 0,
      time: Date.now(),
    });

    useGameStore.setState((st) => ({
      session: st.session
        ? { ...st.session, movesUsed: st.session.movesUsed + 1 }
        : st.session,
    }));

    const remainingCoils = s.currentLevel.coils.filter((c) => {
      const pos = s.coilPositions[c.id];
      return c.id !== coilId && !(pos && pos.delivered);
    });

    if (remainingCoils.length === 0) {
      succeedSession();
    } else {
      setPhase("selecting");
      setStatus("planning");
      useGameStore.setState({
        selectedCoilId: null,
        selectedZoneId: null,
        currentCoilId: null,
      });
    }

    runningRef.current = false;
    planRef.current = null;
    snapRecord();
  };

  const snapRecord = () => {
    const s = useGameStore.getState();
    if (!s.session) return;
    const snapshotPositions: Record<string, { x: number; y: number; z: number; tilt: number; tiltAxis: { x: number; y: number } }> = {};
    for (const [k, v] of Object.entries(s.coilPositions)) {
      snapshotPositions[k] = {
        x: v.x,
        y: v.y,
        z: v.z,
        tilt: v.tilt,
        tiltAxis: v.tiltAxis,
      };
    }
    pushSnapshot({
      cranePositions: { ...s.cranePositions },
      coilPositions: snapshotPositions,
      currentCoilId: s.currentCoilId,
      phase: s.phase,
      status: s.status,
    });
  };

  const startLift = () => {
    const s = useGameStore.getState();
    if (!s.currentLevel || !s.selectedCoilId || !s.selectedZoneId) return;
    if (s.status !== "planning") return;

    const coil = s.currentLevel.coils.find((c) => c.id === s.selectedCoilId);
    const zone = s.currentLevel.zones.find((z) => z.id === s.selectedZoneId);
    const crane = s.currentLevel.cranes[0];
    if (!coil || !zone || !crane) return;

    const pos = s.coilPositions[coil.id];
    if (!pos) return;

    const tiltResult = computeTilt(coil, { x: 0, y: 0 }, s.currentLevel.maxTiltDegrees);
    if (tiltResult.overThreshold) {
      pushEvent({
        type: "center_of_mass",
        severity: "critical",
        detail: `重心偏移超限：倾斜 ${tiltResult.tiltDegrees.toFixed(1)}°`,
        frame: 0,
        time: Date.now(),
      });
      failSession("center_of_mass", `重心偏移超限：倾斜 ${tiltResult.tiltDegrees.toFixed(1)}° > 阈值 ${s.currentLevel.maxTiltDegrees}°`);
      return;
    }

    if (tiltResult.tiltDegrees > s.currentLevel.maxTiltDegrees * 0.6) {
      pushEvent({
        type: "center_of_mass",
        severity: "warning",
        detail: `重心偏移警告：倾斜 ${tiltResult.tiltDegrees.toFixed(1)}°`,
        frame: 0,
        time: Date.now(),
      });
    }

    setCoilPosition(coil.id, {
      ...pos,
      tilt: tiltResult.tiltDegrees,
      tiltAxis: tiltResult.axis,
    });
    setCurrentCoilId(coil.id);

    const cranePos = s.cranePositions[crane.id];
    const isX = crane.axis === "x";
    const startX = isX ? coil.position.x : crane.fixed;
    const startZ = isX ? crane.fixed : coil.position.z;
    const moveOver = {
      startPos: { x: cranePos.x, y: cranePos.y, z: cranePos.z },
      endPos: { x: startX, y: cranePos.y, z: startZ },
      duration: 1.2,
    };

    const endX = isX ? zone.position.x : crane.fixed;
    const endZ = isX ? crane.fixed : zone.position.z;

    const plans: Phase[] = [
      { name: "move-over", ...moveOver, duration: 1.2 },
      {
        name: "lift",
        startPos: { x: startX, y: cranePos.y, z: startZ },
        endPos: { x: startX, y: cranePos.y, z: startZ },
        duration: 1.0,
      },
      {
        name: "travel",
        startPos: { x: startX, y: cranePos.y, z: startZ },
        endPos: { x: endX, y: cranePos.y, z: endZ },
        duration: 1.8,
      },
      {
        name: "drop",
        startPos: { x: endX, y: cranePos.y, z: endZ },
        endPos: { x: endX, y: cranePos.y, z: endZ },
        duration: 1.0,
      },
      {
        name: "done",
        startPos: { x: endX, y: cranePos.y, z: endZ },
        endPos: { x: endX, y: cranePos.y, z: endZ },
        duration: 0.1,
      },
    ];

    planRef.current = {
      level: s.currentLevel,
      coilId: coil.id,
      zoneId: zone.id,
      craneId: crane.id,
    };
    plansRef.current = plans;
    planIdxRef.current = 0;
    phaseProgressRef.current = 0;
    runningRef.current = true;

    setPhase("moving");
    setStatus("running");
    pushEvent({
      type: "info",
      severity: "info",
      detail: `开始吊运：${coil.id} → ${zone.label || zone.id}`,
      frame: 0,
      time: Date.now(),
    });
    snapRecord();
  };

  const stopEngine = () => {
    runningRef.current = false;
    planRef.current = null;
  };

  return { startLift, stopEngine };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
