function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const corners = (noise2D(x - 1, y - 1, seed) + noise2D(x + 1, y - 1, seed) + 
                   noise2D(x - 1, y + 1, seed) + noise2D(x + 1, y + 1, seed)) / 16;
  const sides = (noise2D(x - 1, y, seed) + noise2D(x + 1, y, seed) + 
                 noise2D(x, y - 1, seed) + noise2D(x, y + 1, seed)) / 8;
  const center = noise2D(x, y, seed) / 4;
  return corners + sides + center;
}

function interpolatedNoise(x: number, y: number, seed: number): number {
  const intX = Math.floor(x);
  const fracX = x - intX;
  const intY = Math.floor(y);
  const fracY = y - intY;

  const v1 = smoothNoise(intX, intY, seed);
  const v2 = smoothNoise(intX + 1, intY, seed);
  const v3 = smoothNoise(intX, intY + 1, seed);
  const v4 = smoothNoise(intX + 1, intY + 1, seed);

  const i1 = v1 * (1 - fracX) + v2 * fracX;
  const i2 = v3 * (1 - fracX) + v4 * fracX;

  return i1 * (1 - fracY) + i2 * fracY;
}

export function generateSlopeGeometry(size: number = 40, segments: number = 50, seed: number = 42) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  const step = size / segments;

  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= segments; j++) {
      const x = (j - segments / 2) * step;
      const z = (i - segments / 2) * step;
      
      let y = 0;
      const distFromCenter = Math.sqrt(x * x + z * z) / (size / 2);
      
      if (distFromCenter < 1) {
        const slopeAngle = (1 - distFromCenter) * 0.8;
        const noiseVal = interpolatedNoise(x * 0.3, z * 0.3, seed) * 2 - 1;
        const noiseVal2 = interpolatedNoise(x * 0.8, z * 0.8, seed + 100) * 2 - 1;
        y = slopeAngle * 12 + noiseVal * 1.5 + noiseVal2 * 0.5;
        
        const ridgeX = Math.abs(x) - Math.abs(z) * 0.5;
        if (ridgeX > 0 && ridgeX < 5 && Math.abs(z) < 15) {
          y += (5 - ridgeX) * 0.8;
        }
      }
      
      vertices.push(x, y, z);
      
      const heightFactor = Math.min(Math.max((y + 2) / 15, 0), 1);
      const r = 0.25 + heightFactor * 0.15;
      const g = 0.25 + heightFactor * 0.1;
      const b = 0.2 + heightFactor * 0.05;
      colors.push(r, g, b);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return { vertices, indices, colors };
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'normal':
      return '#00B42A';
    case 'warning':
      return '#FF7D00';
    case 'danger':
      return '#F53F3F';
    default:
      return '#86909C';
  }
}

export function getSourceLabel(source: string): string {
  switch (source) {
    case 'gis':
      return 'GIS数据';
    case 'tablet':
      return '巡检平板';
    case 'excel':
      return 'Excel导入';
    default:
      return source;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'normal':
      return '正常';
    case 'warning':
      return '预警';
    case 'danger':
      return '危险';
    default:
      return status;
  }
}
