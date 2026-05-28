
import { Level } from '../types';

function createDataURL(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, 800, 450);
  return canvas.toDataURL('image/png');
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, 'hsl(' + ((seed * 47) % 360) + ', 40%, 60%)');
  gradient.addColorStop(1, 'hsl(' + ((seed * 83 + 120) % 360) + ', 30%, 40%)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 8; i++) {
    const cx = (w / 8) * i + w / 16;
    const cy = h * 0.4 + Math.sin(i * 0.7 + seed) * 60;
    const radius = 30 + Math.sin(i * 1.3 + seed) * 15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(' + ((seed * 37 + i * 45) % 360) + ', 50%, 55%)';
    ctx.fill();
  }

  for (let x = 0; x < w; x += 4) {
    const y = h * 0.7 + Math.sin(x * 0.01 + seed) * 30;
    ctx.fillStyle = 'hsl(' + ((seed * 17 + 100) % 360) + ', 25%, 35%)';
    ctx.fillRect(x, y, 4, h - y);
  }

  const skinX = w * 0.5;
  const skinY = h * 0.35;
  const faceR = 60;
  ctx.beginPath();
  ctx.arc(skinX, skinY, faceR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(210,170,140)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(skinX - 18, skinY - 12, 6, 0, Math.PI * 2);
  ctx.arc(skinX + 18, skinY - 12, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(60,40,30)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(skinX, skinY + 8, 14, 0, Math.PI);
  ctx.strokeStyle = 'rgb(160,80,60)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTargetScene(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, exposure: number, temp: number, lutStyle: string) {
  drawScene(ctx, w, h, seed);

  if (exposure > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (exposure * 0.15).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  } else if (exposure < 0) {
    ctx.fillStyle = 'rgba(0,0,0,' + (-exposure * 0.15).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  }

  if (temp < 6500) {
    ctx.fillStyle = 'rgba(255,160,50,' + ((6500 - temp) / 6500 * 0.3).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  } else if (temp > 6500) {
    ctx.fillStyle = 'rgba(50,100,255,' + ((temp - 6500) / 3500 * 0.3).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  }

  if (lutStyle === 'cinematic') {
    ctx.fillStyle = 'rgba(20,30,60,0.2)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,200,255,0.05)';
    ctx.fillRect(0, 0, w, h);
  } else if (lutStyle === 'vintage') {
    ctx.fillStyle = 'rgba(180,140,80,0.15)';
    ctx.fillRect(0, 0, w, h);
  } else if (lutStyle === 'cool') {
    ctx.fillStyle = 'rgba(0,80,180,0.15)';
    ctx.fillRect(0, 0, w, h);
  } else if (lutStyle === 'warm') {
    ctx.fillStyle = 'rgba(200,150,30,0.15)';
    ctx.fillRect(0, 0, w, h);
  } else if (lutStyle === 'bw') {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

export const LEVELS: Level[] = [
  {
    id: 'level-1',
    name: '基础曝光训练',
    difficulty: 1,
    sourceImage: createDataURL((ctx, w, h) => drawScene(ctx, w, h, 1)),
    targetImage: createDataURL((ctx, w, h) => drawTargetScene(ctx, w, h, 1, 0.8, 7500, 'cinematic')),
    targetParams: {
      exposure: 0.8,
      temperature: 7500,
      lutId: 'cinematic',
      lutIntensity: 60,
    },
    description: '学习基础曝光调整，将偏暗的画面调整至合适亮度',
  },
  {
    id: 'level-2',
    name: '色温平衡',
    difficulty: 1,
    sourceImage: createDataURL((ctx, w, h) => drawScene(ctx, w, h, 2)),
    targetImage: createDataURL((ctx, w, h) => drawTargetScene(ctx, w, h, 2, 0.3, 5600, 'none')),
    targetParams: {
      exposure: 0.3,
      temperature: 5600,
      lutId: 'none',
      lutIntensity: 0,
    },
    description: '练习色温校正，消除色偏获得自然的色彩表现',
  },
  {
    id: 'level-3',
    name: '电影风格调色',
    difficulty: 2,
    sourceImage: createDataURL((ctx, w, h) => drawScene(ctx, w, h, 3)),
    targetImage: createDataURL((ctx, w, h) => drawTargetScene(ctx, w, h, 3, -0.2, 4200, 'cinematic')),
    targetParams: {
      exposure: -0.2,
      temperature: 4200,
      lutId: 'cinematic',
      lutIntensity: 85,
    },
    description: '运用LUT创造电影级的城市夜景风格',
  },
  {
    id: 'level-4',
    name: '复古胶片感',
    difficulty: 2,
    sourceImage: createDataURL((ctx, w, h) => drawScene(ctx, w, h, 4)),
    targetImage: createDataURL((ctx, w, h) => drawTargetScene(ctx, w, h, 4, 0.5, 3800, 'vintage')),
    targetParams: {
      exposure: 0.5,
      temperature: 3800,
      lutId: 'vintage',
      lutIntensity: 75,
    },
    description: '模拟70年代复古胶片的褪色质感',
  },
  {
    id: 'level-5',
    name: '高难度人像精修',
    difficulty: 3,
    sourceImage: createDataURL((ctx, w, h) => drawScene(ctx, w, h, 5)),
    targetImage: createDataURL((ctx, w, h) => drawTargetScene(ctx, w, h, 5, 0.6, 6500, 'bw')),
    targetParams: {
      exposure: 0.6,
      temperature: 6500,
      lutId: 'bw',
      lutIntensity: 90,
    },
    description: '挑战高对比度黑白人像的专业级调色',
  },
];

export function getLevelById(id: string): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}

export function getDifficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return '入门';
    case 2:
      return '进阶';
    case 3:
      return '专业';
    default:
      return '未知';
  }
}

export function getDifficultyColor(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return '#00ff88';
    case 2:
      return '#ffd700';
    case 3:
      return '#ff3333';
    default:
      return '#888';
  }
}
