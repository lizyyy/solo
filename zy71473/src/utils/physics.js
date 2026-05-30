const GRAVITY = 9.81;
const AIR_DENSITY = 1.225;
const DRAG_COEFFICIENT = 0.295;

export function calculateTrajectory(params) {
  const {
    initialVelocity = 800,
    bulletMass = 0.01,
    bulletDiameter = 0.00762,
    windSpeed = 0,
    windAngle = 0,
    distance = 500,
    elevationAngle = 0,
    timeStep = 0.01
  } = params;

  const crossSectionalArea = Math.PI * Math.pow(bulletDiameter / 2, 2);
  const dragFactor = 0.5 * AIR_DENSITY * DRAG_COEFFICIENT * crossSectionalArea;

  const rad = (elevationAngle * Math.PI) / 180;
  const windRad = (windAngle * Math.PI) / 180;

  let vx = initialVelocity * Math.cos(rad);
  let vy = initialVelocity * Math.sin(rad);
  let vz = 0;

  const windX = windSpeed * Math.cos(windRad);
  const windZ = windSpeed * Math.sin(windRad);

  const points = [];
  let x = 0, y = 0, z = 0;
  let t = 0;
  let maxTime = 10;

  while (t < maxTime && y >= 0) {
    points.push({ x, y, z, t });

    const vRelX = vx - windX;
    const vRelZ = vz - windZ;
    const vRelY = vy;
    const vMag = Math.sqrt(vRelX * vRelX + vRelY * vRelY + vRelZ * vRelZ);

    if (vMag > 0) {
      const dragForce = dragFactor * vMag * vMag;
      const ax = -(dragForce * vRelX) / (bulletMass * vMag);
      const ay = -(dragForce * vRelY) / (bulletMass * vMag) - GRAVITY;
      const az = -(dragForce * vRelZ) / (bulletMass * vMag);

      vx += ax * timeStep;
      vy += ay * timeStep;
      vz += az * timeStep;
    } else {
      vy -= GRAVITY * timeStep;
    }

    x += vx * timeStep;
    y += vy * timeStep;
    z += vz * timeStep;
    t += timeStep;

    if (x >= distance) break;
  }

  const finalPoint = points[points.length - 1] || { x: 0, y: 0, z: 0, t: 0 };

  return {
    points,
    impact: {
      x: finalPoint.x,
      y: finalPoint.y,
      z: finalPoint.z,
      time: finalPoint.t
    },
    windDeflection: finalPoint.z,
    drop: finalPoint.y
  };
}

export function calculateWindDrift(params) {
  const { windSpeed, windAngle, distance, initialVelocity } = params;
  const windRad = (windAngle * Math.PI) / 180;
  const crossWind = windSpeed * Math.sin(windRad);
  const flightTime = distance / initialVelocity;
  return crossWind * flightTime * 0.8;
}

export function validateParams(params) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (params.initialVelocity < 100 || params.initialVelocity > 1500) {
    errors.push({ type: 'velocity', message: '初速超出有效范围 (100-1500 m/s)', value: params.initialVelocity });
  }

  if (params.bulletMass < 0.001 || params.bulletMass > 0.1) {
    errors.push({ type: 'mass', message: '弹丸质量超出有效范围 (0.001-0.1 kg)', value: params.bulletMass });
  }

  if (params.distance < 10 || params.distance > 5000) {
    errors.push({ type: 'distance', message: '距离超界，有效范围 (10-5000 m)', value: params.distance });
  }

  if (Math.abs(params.windAngle) > 180) {
    warnings.push({ type: 'wind_direction', message: '风向角度异常，建议范围 (-180° ~ 180°)', value: params.windAngle });
  }

  if (params.windAngle < -90 || params.windAngle > 90) {
    if (params.windSpeed > 0) {
      info.push({ type: 'wind_reverse', message: '检测到反向风，请确认风向设置', value: params.windAngle });
    }
  }

  if (params.units && params.units !== 'metric') {
    warnings.push({ type: 'units', message: '单位混用风险，当前使用非标准单位', value: params.units });
  }

  return { errors, warnings, info, isValid: errors.length === 0 };
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
