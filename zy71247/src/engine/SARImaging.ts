import { GameParams, SceneConfig } from '../types';

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function addNoise(image: number[][], level: number, type: string): number[][] {
  const result = image.map(row => [...row]);
  const noiseFactor = level / 100;

  for (let y = 0; y < result.length; y++) {
    for (let x = 0; x < result[y].length; x++) {
      let noise = 0;
      switch (type) {
        case 'gaussian':
          noise = gaussianRandom() * noiseFactor * 0.5;
          break;
        case 'speckle':
          noise = (1 + gaussianRandom() * noiseFactor);
          result[y][x] *= noise;
          continue;
        case 'impulse':
          if (Math.random() < noiseFactor * 0.1) {
            result[y][x] = Math.random() > 0.5 ? 1 : 0;
          }
          continue;
      }
      result[y][x] = Math.max(0, Math.min(1, result[y][x] + noise));
    }
  }
  return result;
}

function applyTrackOffset(image: number[][], offsetX: number, offsetY: number): number[][] {
  const result: number[][] = [];
  const height = image.length;
  const width = image[0].length;

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const srcX = Math.round(x - offsetX * 0.3);
      const srcY = Math.round(y - offsetY * 0.3);
      
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        row.push(image[srcY][srcX]);
      } else {
        row.push(0.1);
      }
    }
    result.push(row);
  }
  return result;
}

function applySamplingBlur(image: number[][], samplingInterval: number, idealInterval: number): number[][] {
  const ratio = samplingInterval / idealInterval;
  if (ratio <= 1) return image.map(row => [...row]);

  const result: number[][] = [];
  const kernelSize = Math.min(Math.floor(ratio * 2), 7);
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = 0; y < image.length; y++) {
    const row: number[] = [];
    for (let x = 0; x < image[y].length; x++) {
      let sum = 0;
      let count = 0;
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const sy = y + ky;
          const sx = x + kx;
          if (sy >= 0 && sy < image.length && sx >= 0 && sx < image[y].length) {
            sum += image[sy][sx];
            count++;
          }
        }
      }
      row.push(count > 0 ? sum / count : 0);
    }
    result.push(row);
  }
  return result;
}

export function generateEchoData(targetImage: number[][], params: GameParams): number[][] {
  const height = targetImage.length;
  const width = targetImage[0].length;
  const echoData: number[][] = [];

  for (let i = 0; i < params.sampling.count; i++) {
    const row: number[] = [];
    for (let j = 0; j < width; j++) {
      const y = Math.floor((i / params.sampling.count) * height);
      let value = targetImage[y][j];
      
      const phase = Math.sin(i * 0.1 + j * 0.05) * 0.1;
      value += phase;
      
      row.push(Math.max(0, Math.min(1, value)));
    }
    echoData.push(row);
  }

  return echoData;
}

export function simulateSARImaging(
  scene: SceneConfig,
  params: GameParams
): { echoData: number[][]; processedImage: number[][] } {
  let image = scene.targetImage.map(row => [...row]);

  image = applyTrackOffset(image, params.flightPath.offsetX, params.flightPath.offsetY);
  image = applySamplingBlur(image, params.sampling.interval, scene.idealParams.samplingInterval);
  image = addNoise(image, params.noise.level, params.noise.type);

  const echoData = generateEchoData(image, params);

  return { echoData, processedImage: image };
}
