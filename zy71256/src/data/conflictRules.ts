export const CONFLICT_RULES = {
  voltageMixed: {
    type: 'voltage_mixed' as const,
    voltageDiffThreshold: 1.0,
    severity: 'error' as const,
  },
  pinMux: {
    type: 'pin_mux' as const,
    minFunctionCount: 3,
    severity: 'warning' as const,
  },
  labelOcclusion: {
    type: 'label_occlusion' as const,
    distanceThreshold: 0.20,
    severity: 'warning' as const,
  },
};
