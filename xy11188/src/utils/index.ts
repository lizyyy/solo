export function formatVolume(volume: number): string {
  return `${volume.toFixed(3)} m³`;
}

export function formatWeight(weight: number): string {
  return `${weight.toFixed(2)} kg`;
}

export function formatCurrency(amount: number): string {
  return `${amount} 元`;
}

export function calculateTruckVolume(width: number, height: number, depth: number): number {
  return (width * height * depth) / 1000000000;
}

export function validateDimensions(width: number, height: number, depth: number): boolean {
  return width > 0 && height > 0 && depth > 0;
}

export function validateWeight(weight: number): boolean {
  return weight > 0;
}
