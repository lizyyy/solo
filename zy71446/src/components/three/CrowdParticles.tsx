import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';
import { zones } from '../../data/stationConfig';
import { timeToMinutes } from '../../utils/timeUtils';

interface ParticleData {
  position: THREE.Vector3;
  targetZone: string;
  speed: number;
  offset: number;
}

const MAX_PARTICLES = 1500;

const zoneCenters: Record<string, THREE.Vector3> = {
  concourse_main: new THREE.Vector3(0, 0.5, 0),
  platform_line1: new THREE.Vector3(0, -2.5, 25),
  platform_line10: new THREE.Vector3(0, -5.5, -25),
  escalator_group_a: new THREE.Vector3(-5, -1, 15),
  escalator_group_b: new THREE.Vector3(5, -4, -15),
  turnstile_north: new THREE.Vector3(0, 0.5, 10),
  turnstile_south: new THREE.Vector3(0, 0.5, -10),
  corridor_main: new THREE.Vector3(0, 0.5, 0),
  entrance_north: new THREE.Vector3(0, 0.5, 19),
  entrance_south: new THREE.Vector3(0, 0.5, -19),
};

export function CrowdParticles() {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const particlesRef = useRef<ParticleData[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const timeRef = useRef(0);

  const crowdData = useSimulationStore((state) => state.crowdData);
  const currentTime = useSimulationStore((state) => state.currentTime);

  useEffect(() => {
    particlesRef.current = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const startZone = getRandomStartZone();
      const targetZone = getRandomTargetZone(startZone);
      particlesRef.current.push({
        position: zoneCenters[startZone].clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 8
          )
        ),
        targetZone,
        speed: 0.02 + Math.random() * 0.03,
        offset: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  useFrame((state, delta) => {
    if (!instancedMeshRef.current) return;

    timeRef.current += delta;

    const totalCount = Array.from(crowdData.values()).reduce((sum, d) => sum + d.count, 0);
    const activeParticles = Math.min(MAX_PARTICLES, Math.floor(totalCount * 1.5));

    const currentMinutes = timeToMinutes(currentTime);
    const isPeakHour = currentMinutes >= timeToMinutes('07:30') && currentMinutes <= timeToMinutes('08:45');

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i >= activeParticles) {
        dummy.position.set(100, 100, 100);
        dummy.updateMatrix();
        instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const particle = particlesRef.current[i];
      if (!particle) continue;

      const target = zoneCenters[particle.targetZone];
      if (!target) continue;

      const direction = target.clone().sub(particle.position);
      const distance = direction.length();

      if (distance < 1) {
        const newTarget = getRandomTargetZone(particle.targetZone);
        particle.targetZone = newTarget;
      } else {
        direction.normalize();
        const speed = particle.speed * (isPeakHour ? 1.5 : 1);
        particle.position.add(direction.multiplyScalar(speed));
      }

      const wobble = Math.sin(timeRef.current * 2 + particle.offset) * 0.1;

      dummy.position.set(
        particle.position.x + wobble,
        particle.position.y + Math.sin(timeRef.current * 3 + particle.offset) * 0.05,
        particle.position.z + wobble * 0.5
      );

      const scale = 0.15 + Math.random() * 0.05;
      dummy.scale.setScalar(scale);

      const targetData = crowdData.get(particle.targetZone);
      const concourseData = crowdData.get('concourse_main');
      const capacity = concourseData ? (concourseData.count / 800) : 0.5;

      let color = new THREE.Color('#00D4FF');
      if (capacity > 0.9) color = new THREE.Color('#FFB800');
      if (capacity > 1.2) color = new THREE.Color('#FF3B30');

      const mat = instancedMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.color = color;
      mat.emissive = color;

      dummy.updateMatrix();
      instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
    }

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color="#00D4FF"
        emissive="#00D4FF"
        emissiveIntensity={0.8}
        transparent
        opacity={0.8}
        roughness={0.2}
        metalness={0.8}
      />
    </instancedMesh>
  );
}

function getRandomStartZone(): string {
  const zones = ['entrance_north', 'entrance_south', 'platform_line1', 'platform_line10'];
  return zones[Math.floor(Math.random() * zones.length)];
}

function getRandomTargetZone(fromZone: string): string {
  const weights: Record<string, Record<string, number>> = {
    entrance_north: { concourse_main: 0.6, turnstile_north: 0.3, corridor_main: 0.1 },
    entrance_south: { concourse_main: 0.6, turnstile_south: 0.3, corridor_main: 0.1 },
    concourse_main: { escalator_group_a: 0.35, escalator_group_b: 0.35, turnstile_north: 0.1, turnstile_south: 0.1, corridor_main: 0.1 },
    platform_line1: { escalator_group_a: 0.8, corridor_main: 0.2 },
    platform_line10: { escalator_group_b: 0.8, corridor_main: 0.2 },
    escalator_group_a: { platform_line1: 0.5, concourse_main: 0.5 },
    escalator_group_b: { platform_line10: 0.5, concourse_main: 0.5 },
    turnstile_north: { concourse_main: 0.8, entrance_north: 0.2 },
    turnstile_south: { concourse_main: 0.8, entrance_south: 0.2 },
    corridor_main: { concourse_main: 0.5, escalator_group_a: 0.25, escalator_group_b: 0.25 },
  };

  const zoneWeights = weights[fromZone] || weights.concourse_main;
  const entries = Object.entries(zoneWeights);
  const random = Math.random();
  let cumulative = 0;

  for (const [zone, weight] of entries) {
    cumulative += weight;
    if (random < cumulative) return zone;
  }

  return 'concourse_main';
}
