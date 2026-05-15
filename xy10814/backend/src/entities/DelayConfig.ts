export interface DelayConfig {
  enabled: boolean;
  minDelay: number;
  maxDelay: number;
  fixedDelay?: number;
  strategy: 'fixed' | 'random' | 'linear';
}
