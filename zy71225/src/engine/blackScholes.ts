export function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) return 1 - prob;
  return prob;
}

export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export function calculateBlackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: 'call' | 'put'
): BSResult {
  if (T <= 0) {
    const intrinsicValue = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return {
      price: intrinsicValue,
      delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0,
      vega: 0,
      theta: 0,
      rho: 0,
    };
  }

  const sigmaSqrtT = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;

  const nd1 = normalCDF(d1);
  const nd2 = normalCDF(d2);
  const nd1Minus = normalCDF(-d1);
  const nd2Minus = normalCDF(-d2);
  const pd1 = normalPDF(d1);

  let price: number;
  let delta: number;
  let theta: number;
  let rho: number;

  if (type === 'call') {
    price = S * nd1 - K * Math.exp(-r * T) * nd2;
    delta = nd1;
    theta = (-S * pd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * nd2;
    rho = K * T * Math.exp(-r * T) * nd2;
  } else {
    price = K * Math.exp(-r * T) * nd2Minus - S * nd1Minus;
    delta = nd1 - 1;
    theta = (-S * pd1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * nd2Minus;
    rho = -K * T * Math.exp(-r * T) * nd2Minus;
  }

  const gamma = pd1 / (S * sigma * Math.sqrt(T));
  const vega = S * pd1 * Math.sqrt(T) * 0.01;

  theta = theta / 365;
  rho = rho * 0.01;

  return { price, delta, gamma, vega, theta, rho };
}
