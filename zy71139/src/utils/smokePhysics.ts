import { Fan, SmokeParticle, SmokeSource, EscapeRoute } from '../types';

const TUNNEL_WIDTH = 12;
const TUNNEL_HEIGHT = 6;
const MAX_PARTICLES = 500;
const PARTICLE_LIFETIME = 300;

export const generateSmokeParticles = (
  sources: SmokeSource[],
  step: number
): SmokeParticle[] => {
  const newParticles: SmokeParticle[] = [];
  
  sources.forEach((source) => {
    if (!source.active) return;
    
    const particlesToSpawn = Math.floor(source.intensity * 3);
    for (let i = 0; i < particlesToSpawn; i++) {
      newParticles.push({
        id: `smoke-${step}-${Date.now()}-${Math.random()}`,
        position: {
          x: source.position.x + (Math.random() - 0.5) * 2,
          y: source.position.y + Math.random() * 0.5,
          z: source.position.z + (Math.random() - 0.5) * 2
        },
        velocity: {
          x: (Math.random() - 0.5) * 0.1,
          y: 0.02 + Math.random() * 0.02,
          z: (Math.random() - 0.5) * 0.1
        },
        density: 0.5 + Math.random() * 0.5,
        life: 1
      });
    }
  });
  
  return newParticles;
};

export const calculateWindVelocity = (
  position: { x: number; y: number; z: number },
  fans: Fan[]
): { x: number; y: number; z: number } => {
  let windX = 0;
  let windZ = 0;
  
  fans.forEach((fan) => {
    if (!fan.isOn) return;
    
    const dx = position.x - fan.position.x;
    const dy = position.y - fan.position.y;
    const dz = position.z - fan.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < 0.5) return;
    
    const fanStrength = (fan.power / 100) * 0.3;
    const falloff = Math.max(0, 1 - distance / 25);
    const direction = fan.direction === 'forward' ? 1 : -1;
    
    windX += direction * fanStrength * falloff;
    
    const lateralSpread = Math.max(0, 1 - Math.abs(dz) / 10);
    windZ += -dz * 0.01 * falloff * lateralSpread;
  });
  
  return { x: windX, y: 0, z: windZ };
};

export const updateSmokePhysics = (
  particles: SmokeParticle[],
  fans: Fan[],
  escapeRoutes: EscapeRoute[],
  deltaTime: number = 1
): {
  particles: SmokeParticle[];
  blockedRoutes: string[];
  coverage: number;
} => {
  const updatedParticles: SmokeParticle[] = [];
  const blockedRoutes: string[] = [];
  
  particles.forEach((particle) => {
    const wind = calculateWindVelocity(particle.position, fans);
    
    const buoyancy = 0.015;
    const diffusion = 0.005;
    
    const newVelocity = {
      x: particle.velocity.x + wind.x * deltaTime + (Math.random() - 0.5) * diffusion,
      y: particle.velocity.y + buoyancy * deltaTime + (Math.random() - 0.5) * diffusion * 0.5,
      z: particle.velocity.z + wind.z * deltaTime + (Math.random() - 0.5) * diffusion
    };
    
    let newX = particle.position.x + newVelocity.x * deltaTime;
    let newY = particle.position.y + newVelocity.y * deltaTime;
    let newZ = particle.position.z + newVelocity.z * deltaTime;
    
    const halfWidth = TUNNEL_WIDTH / 2;
    if (newZ < -halfWidth) {
      newZ = -halfWidth;
      newVelocity.z *= -0.3;
    }
    if (newZ > halfWidth) {
      newZ = halfWidth;
      newVelocity.z *= -0.3;
    }
    if (newY > TUNNEL_HEIGHT) {
      newY = TUNNEL_HEIGHT;
      newVelocity.y *= -0.2;
    }
    if (newY < 0.5) {
      newY = 0.5;
      newVelocity.y = Math.abs(newVelocity.y) * 0.3;
    }
    
    const newLife = particle.life - (1 / PARTICLE_LIFETIME) * deltaTime;
    
    if (newLife > 0) {
      updatedParticles.push({
        ...particle,
        position: { x: newX, y: newY, z: newZ },
        velocity: newVelocity,
        life: newLife
      });
    }
  });
  
  escapeRoutes.forEach((route) => {
    const nearbySmoke = updatedParticles.filter((p) => {
      const dx = p.position.x - route.position.x;
      const dy = p.position.y - route.position.y;
      const dz = p.position.z - route.position.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) < 5 && p.life > 0.3;
    });
    
    if (nearbySmoke.length > 10) {
      blockedRoutes.push(route.id);
    }
  });
  
  const coverage = Math.min(100, (updatedParticles.length / MAX_PARTICLES) * 100);
  
  return {
    particles: updatedParticles.slice(-MAX_PARTICLES),
    blockedRoutes,
    coverage
  };
};
