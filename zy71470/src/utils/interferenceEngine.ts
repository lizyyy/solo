import type { FilmParams, SpectrumPoint, RGB, XYZ, CalculationResult } from '@/types';
import { toRadians } from './unitConversion';
import { cieMatchingFunctions, d65Spectrum, ENGINE_VERSION } from '@/data/cieData';

interface Complex {
  re: number;
  im: number;
}

const complexAdd = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

const complexSub = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

const complexMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

const complexDiv = (a: Complex, b: Complex): Complex => {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
};

const complexExp = (im: number): Complex => ({
  re: Math.cos(im),
  im: Math.sin(im),
});

const complexAbs2 = (c: Complex): number => c.re * c.re + c.im * c.im;

export const fresnelCoefficients = (
  n1: number,
  n2: number,
  theta1: number,
  polarization: 's' | 'p'
): { rs: number; rp: number; ts: number; tp: number } => {
  const sinTheta2 = (n1 / n2) * Math.sin(theta1);

  if (Math.abs(sinTheta2) > 1) {
    return { rs: 1, rp: -1, ts: 0, tp: 0 };
  }

  const theta2 = Math.asin(sinTheta2);
  const cosTheta1 = Math.cos(theta1);
  const cosTheta2 = Math.cos(theta2);

  const rs = (n1 * cosTheta1 - n2 * cosTheta2) / (n1 * cosTheta1 + n2 * cosTheta2);
  const rp = (n2 * cosTheta1 - n1 * cosTheta2) / (n2 * cosTheta1 + n1 * cosTheta2);
  const ts = (2 * n1 * cosTheta1) / (n1 * cosTheta1 + n2 * cosTheta2);
  const tp = (2 * n1 * cosTheta1) / (n2 * cosTheta1 + n1 * cosTheta2);

  if (polarization === 's') {
    return { rs, rp: 0, ts, tp: 0 };
  } else if (polarization === 'p') {
    return { rs: 0, rp, ts: 0, tp };
  }
  return { rs, rp, ts, tp };
};

export const calculateReflectance = (
  params: FilmParams,
  wavelengthNm: number
): number => {
  const {
    thickness,
    refractiveIndex: n2,
    incidentAngle,
    angleUnit,
    substrateN: n3,
    ambientN: n1,
    polarization,
  } = params;

  const theta1 = toRadians(incidentAngle, angleUnit);
  const d = thickness;
  const lambda = wavelengthNm;

  const sinTheta2 = (n1 / n2) * Math.sin(theta1);
  if (Math.abs(sinTheta2) > 1) {
    return 1.0;
  }
  const theta2 = Math.asin(sinTheta2);
  const cosTheta2 = Math.cos(theta2);

  const delta = (4 * Math.PI * n2 * d * cosTheta2) / lambda;

  const { rs: r12_s, rp: r12_p } = fresnelCoefficients(n1, n2, theta1, 's');
  const { rs: r23_s, rp: r23_p } = fresnelCoefficients(n2, n3, theta2, 's');

  let R_s = 0;
  let R_p = 0;

  if (polarization !== 'p') {
    const r12: Complex = { re: r12_s, im: 0 };
    const r23: Complex = { re: r23_s, im: 0 };
    const expDelta = complexExp(-delta);

    const numerator = complexAdd(r12, complexMul(r23, expDelta));
    const denominator = complexAdd(
      { re: 1, im: 0 },
      complexMul(complexMul(r12, r23), expDelta)
    );
    const r_total = complexDiv(numerator, denominator);
    R_s = complexAbs2(r_total);
  }

  if (polarization !== 's') {
    const { rp: r12_p_val } = fresnelCoefficients(n1, n2, theta1, 'p');
    const { rp: r23_p_val } = fresnelCoefficients(n2, n3, theta2, 'p');
    const r12: Complex = { re: r12_p_val, im: 0 };
    const r23: Complex = { re: r23_p_val, im: 0 };
    const expDelta = complexExp(-delta);

    const numerator = complexAdd(r12, complexMul(r23, expDelta));
    const denominator = complexAdd(
      { re: 1, im: 0 },
      complexMul(complexMul(r12, r23), expDelta)
    );
    const r_total = complexDiv(numerator, denominator);
    R_p = complexAbs2(r_total);
  }

  if (polarization === 's') return R_s;
  if (polarization === 'p') return R_p;
  return (R_s + R_p) / 2;
};

export const calculateSpectrum = (
  params: FilmParams,
  stepNm: number = 5
): SpectrumPoint[] => {
  const { min, max } = params.wavelengthRange;
  const spectrum: SpectrumPoint[] = [];

  for (let lambda = min; lambda <= max; lambda += stepNm) {
    const reflectance = calculateReflectance(params, lambda);
    spectrum.push({ wavelength: lambda, reflectance });
  }

  return spectrum;
};

const interpolateCIE = (wavelength: number): { x: number; y: number; z: number } => {
  if (wavelength < 380 || wavelength > 780) {
    return { x: 0, y: 0, z: 0 };
  }

  for (let i = 0; i < cieMatchingFunctions.length - 1; i++) {
    const curr = cieMatchingFunctions[i];
    const next = cieMatchingFunctions[i + 1];

    if (wavelength >= curr.wavelength && wavelength <= next.wavelength) {
      const t = (wavelength - curr.wavelength) / (next.wavelength - curr.wavelength);
      return {
        x: curr.x + t * (next.x - curr.x),
        y: curr.y + t * (next.y - curr.y),
        z: curr.z + t * (next.z - curr.z),
      };
    }
  }

  return { x: 0, y: 0, z: 0 };
};

const interpolateD65 = (wavelength: number): number => {
  if (wavelength < 380 || wavelength > 780) {
    return 0;
  }

  for (let i = 0; i < d65Spectrum.length - 1; i++) {
    const curr = d65Spectrum[i];
    const next = d65Spectrum[i + 1];

    if (wavelength >= curr.wavelength && wavelength <= next.wavelength) {
      const t = (wavelength - curr.wavelength) / (next.wavelength - curr.wavelength);
      return curr.intensity + t * (next.intensity - curr.intensity);
    }
  }

  return 0;
};

const interpolateSpectrum = (spectrum: SpectrumPoint[], wavelength: number): number => {
  if (spectrum.length === 0) return 0;

  if (wavelength <= spectrum[0].wavelength) return spectrum[0].reflectance;
  if (wavelength >= spectrum[spectrum.length - 1].wavelength) {
    return spectrum[spectrum.length - 1].reflectance;
  }

  for (let i = 0; i < spectrum.length - 1; i++) {
    const curr = spectrum[i];
    const next = spectrum[i + 1];

    if (wavelength >= curr.wavelength && wavelength <= next.wavelength) {
      const t = (wavelength - curr.wavelength) / (next.wavelength - curr.wavelength);
      return curr.reflectance + t * (next.reflectance - curr.reflectance);
    }
  }

  return 0;
};

export const spectrumToXYZ = (spectrum: SpectrumPoint[]): XYZ => {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let Yn = 0;

  const step = 1;

  for (let lambda = 380; lambda <= 780; lambda += step) {
    const R = interpolateSpectrum(spectrum, lambda);
    const S = interpolateD65(lambda);
    const { x, y, z } = interpolateCIE(lambda);

    X += S * R * x * step;
    Y += S * R * y * step;
    Z += S * R * z * step;
    Yn += S * y * step;
  }

  const k = 1 / Yn;

  return {
    x: X * k,
    y: Y * k,
    z: Z * k,
  };
};

export const xyzToSRGB = (xyz: XYZ): RGB => {
  const { x, y, z } = xyz;

  let R = 3.24096994 * x - 1.53738318 * y - 0.49861076 * z;
  let G = -0.96924364 * x + 1.8759675 * y + 0.04155506 * z;
  let B = 0.05563008 * x - 0.20397696 * y + 1.05697151 * z;

  const gammaCorrect = (c: number): number => {
    if (c <= 0.0031308) {
      return 12.92 * c;
    }
    return 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
  };

  R = gammaCorrect(R);
  G = gammaCorrect(G);
  B = gammaCorrect(B);

  const maxVal = Math.max(R, G, B);
  if (maxVal > 1) {
    R /= maxVal;
    G /= maxVal;
    B /= maxVal;
  }

  return {
    r: Math.max(0, Math.min(1, R)),
    g: Math.max(0, Math.min(1, G)),
    b: Math.max(0, Math.min(1, B)),
  };
};

export const calculateDominantWavelength = (xyz: XYZ): number => {
  const { x, y, z } = xyz;
  const sum = x + y + z;
  if (sum === 0) return 0;

  const x_chroma = x / sum;
  const y_chroma = y / sum;

  let maxReflectance = 0;
  let dominantLambda = 550;

  for (let lambda = 380; lambda <= 780; lambda += 5) {
    const { x: cx, y: cy, z: cz } = interpolateCIE(lambda);
    const sum_c = cx + cy + cz;
    if (sum_c === 0) continue;

    const x_s = cx / sum_c;
    const y_s = cy / sum_c;

    const dist = Math.sqrt(
      Math.pow(x_chroma - x_s, 2) + Math.pow(y_chroma - y_s, 2)
    );

    const spectrum: SpectrumPoint[] = [];
    for (let l = 380; l <= 780; l += 5) {
      spectrum.push({
        wavelength: l,
        reflectance: l >= lambda - 10 && l <= lambda + 10 ? 1 : 0,
      });
    }
    const testXYZ = spectrumToXYZ(spectrum);
    const testSum = testXYZ.x + testXYZ.y + testXYZ.z;
    if (testSum > maxReflectance && dist < 0.1) {
      maxReflectance = testSum;
      dominantLambda = lambda;
    }
  }

  return dominantLambda;
};

export const calculateColorTemperature = (xyz: XYZ): number => {
  const { x, y, z } = xyz;
  const sum = x + y + z;
  if (sum === 0) return 0;

  const x_chroma = x / sum;
  const y_chroma = y / sum;

  const n = (x_chroma - 0.3320) / (0.1858 - y_chroma);
  const CCT = 437 * Math.pow(n, 3) + 3601 * Math.pow(n, 2) + 6861 * n + 5517;

  return Math.round(CCT);
};

export const calculateOpticalPathDiff = (params: FilmParams): number => {
  const { thickness, refractiveIndex, incidentAngle, angleUnit } = params;
  const theta1 = toRadians(incidentAngle, angleUnit);
  const sinTheta2 = (params.ambientN / refractiveIndex) * Math.sin(theta1);

  if (Math.abs(sinTheta2) > 1) {
    return 0;
  }

  const theta2 = Math.asin(sinTheta2);
  const cosTheta2 = Math.cos(theta2);

  return 2 * refractiveIndex * thickness * cosTheta2;
};

export const calculateInterferenceOrder = (params: FilmParams): number => {
  const opd = calculateOpticalPathDiff(params);
  const centralWavelength =
    (params.wavelengthRange.min + params.wavelengthRange.max) / 2;
  return Math.round(opd / centralWavelength);
};

export const calculateFullResult = (
  params: FilmParams,
  spectrumStep: number = 5
): CalculationResult => {
  const spectrum = calculateSpectrum(params, spectrumStep);
  const xyz = spectrumToXYZ(spectrum);
  const rgb = xyzToSRGB(xyz);
  const dominantWavelength = calculateDominantWavelength(xyz);
  const colorTemperature = calculateColorTemperature(xyz);
  const opticalPathDiff = calculateOpticalPathDiff(params);
  const interferenceOrder = calculateInterferenceOrder(params);

  return {
    params: JSON.parse(JSON.stringify(params)),
    spectrum,
    reflectedColor: rgb,
    xyz,
    dominantWavelength,
    colorTemperature,
    interferenceOrder,
    opticalPathDiff,
    timestamp: Date.now(),
    engineVersion: ENGINE_VERSION,
  };
};

export const rgbToHex = (rgb: RGB): string => {
  const toHex = (c: number): string => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};
