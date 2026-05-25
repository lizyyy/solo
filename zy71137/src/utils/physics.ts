import { AdjacentField, Canal, ParticleData } from '@/types';
import { GRAVITY, MAX_PARTICLES, PARTICLE_LIFETIME } from '@/data/constants';

export function createParticle(
  id: number,
  position: [number, number, number],
  windSpeed: number,
  windDirection: number,
  dropletSize: number
): ParticleData {
  const windRad = (windDirection * Math.PI) / 180;
  const baseVelocity: [number, number, number] = [
    Math.sin(windRad) * windSpeed * 0.5,
    0.5 + Math.random() * 0.5,
    Math.cos(windRad) * windSpeed * 0.5,
  ];

  const randomSpread = 0.3;
  return {
    id,
    position: [...position] as [number, number, number],
    velocity: [
      baseVelocity[0] + (Math.random() - 0.5) * randomSpread,
      baseVelocity[1] + (Math.random() - 0.5) * randomSpread * 0.5,
      baseVelocity[2] + (Math.random() - 0.5) * randomSpread,
    ],
    lifetime: 0,
    maxLifetime: PARTICLE_LIFETIME + Math.random() * 3,
    size: dropletSize * (0.8 + Math.random() * 0.4),
  };
}

export function updateParticles(
  particles: ParticleData[],
  windSpeed: number,
  windDirection: number,
  deltaTime: number,
  simulationSpeed: number
): { particles: ParticleData[]; maxDistance: number } {
  const windRad = (windDirection * Math.PI) / 180;
  const windForce: [number, number, number] = [
    Math.sin(windRad) * windSpeed * 0.1,
    0,
    Math.cos(windRad) * windSpeed * 0.1,
  ];

  const adjustedDelta = deltaTime * simulationSpeed;
  let maxDistance = 0;

  const updatedParticles = particles
    .map((particle) => {
      const { position, velocity, lifetime, maxLifetime } = particle;

      if (lifetime >= maxLifetime || position[1] <= 0) {
        return null;
      }

      const newVelocity: [number, number, number] = [
        velocity[0] + windForce[0] * adjustedDelta,
        velocity[1] + GRAVITY * 0.1 * adjustedDelta,
        velocity[2] + windForce[2] * adjustedDelta,
      ];

      const newPosition: [number, number, number] = [
        position[0] + newVelocity[0] * adjustedDelta,
        Math.max(0, position[1] + newVelocity[1] * adjustedDelta),
        position[2] + newVelocity[2] * adjustedDelta,
      ];

      const distance = Math.sqrt(
        newPosition[0] * newPosition[0] + newPosition[2] * newPosition[2]
      );
      maxDistance = Math.max(maxDistance, distance);

      return {
        ...particle,
        position: newPosition,
        velocity: newVelocity,
        lifetime: lifetime + adjustedDelta,
      };
    })
    .filter((p): p is ParticleData => p !== null);

  return { particles: updatedParticles.slice(-MAX_PARTICLES), maxDistance };
}

export function isPointInRect(
  px: number,
  pz: number,
  rx: number,
  rz: number,
  rw: number,
  rd: number
): boolean {
  return (
    px >= rx - rw / 2 &&
    px <= rx + rw / 2 &&
    pz >= rz - rd / 2 &&
    pz <= rz + rd / 2
  );
}

export function isPointInBufferZone(
  px: number,
  pz: number,
  field: AdjacentField
): { inBuffer: boolean; inField: boolean } {
  const [fx, , fz] = field.position;
  const [fw, fd] = field.size;
  const buffer = field.bufferZone;

  const inField = isPointInRect(px, pz, fx, fz, fw, fd);
  const inBuffer = isPointInRect(px, pz, fx, fz, fw + buffer * 2, fd + buffer * 2);

  return { inBuffer: inBuffer && !inField, inField };
}

export function isPointInCanal(
  px: number,
  pz: number,
  canal: Canal
): boolean {
  const [cx, , cz] = canal.position;
  const [cw, cd] = canal.size;
  return isPointInRect(px, pz, cx, cz, cw, cd);
}

export function checkDriftAlerts(
  particles: ParticleData[],
  adjacentFields: AdjacentField[],
  canal: Canal,
  bufferThreshold: number,
  addAlert: (alert: {
    type: 'buffer' | 'canal' | 'concentration';
    severity: 'warning' | 'danger';
    message: string;
    fieldName?: string;
    location?: [number, number, number];
  }) => void
): void {
  const fieldCounts: Record<string, { buffer: number; field: number }> = {};
  let canalCount = 0;

  particles.forEach((particle) => {
    const [px, , pz] = particle.position;

    adjacentFields.forEach((field) => {
      const { inBuffer, inField } = isPointInBufferZone(px, pz, field);
      if (!fieldCounts[field.id]) {
        fieldCounts[field.id] = { buffer: 0, field: 0 };
      }
      if (inBuffer) fieldCounts[field.id].buffer++;
      if (inField) fieldCounts[field.id].field++;
    });

    if (isPointInCanal(px, pz, canal)) {
      canalCount++;
    }
  });

  const fieldThreshold = Math.max(3, Math.round(10 * bufferThreshold));
  const bufferWarningThreshold = Math.max(1, Math.round(5 * bufferThreshold));
  const canalThreshold = Math.max(3, Math.round(8 * bufferThreshold));

  adjacentFields.forEach((field) => {
    const counts = fieldCounts[field.id];
    if (counts) {
      if (counts.field > fieldThreshold) {
        addAlert({
          type: 'concentration',
          severity: 'danger',
          message: `药雾已侵入 ${field.name}，可能造成污染！`,
          fieldName: field.name,
        });
      } else if (counts.buffer > bufferWarningThreshold) {
        addAlert({
          type: 'buffer',
          severity: 'warning',
          message: `药雾接近 ${field.name} 缓冲区，请注意控制`,
          fieldName: field.name,
        });
      }
    }
  });

  if (canalCount > canalThreshold) {
    addAlert({
      type: 'canal',
      severity: 'danger',
      message: '药雾飘入水渠，可能造成水体污染！',
    });
  }
}