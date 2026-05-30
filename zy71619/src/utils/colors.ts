export const COLORS = {
  oceanDeep: "#0A2540",
  oceanMid: "#0D3B66",
  oceanLight: "#1A5276",
  waveTeal: "#00D4AA",
  waveTealDim: "#00A88A",
  sunsetOrange: "#FF6B35",
  sunsetOrangeDim: "#CC5529",
  foam: "#E8F8F5",
  foamDim: "#A3D9CC",
  purple: "#6C5CE7",
  yellow: "#FDCB6E",
  pink: "#E84393",
  dangerRed: "#FF4757",
  dangerRedDim: "#C0392B",
  bgDark: "#050E1A",
  cardBg: "rgba(10, 37, 64, 0.85)",
  cardBorder: "rgba(0, 212, 170, 0.2)",
  textPrimary: "#E8F8F5",
  textSecondary: "#A3D9CC",
  textMuted: "#5B8A8A",
}

export function waveColor(index: number): string {
  const palette = ["#00D4AA", "#FF6B35", "#6C5CE7", "#FDCB6E", "#E84393", "#00B894"]
  return palette[index % palette.length]
}
