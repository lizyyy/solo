export class UnitConverter {
  static litersToCubicCentimeters(liters: number): number {
    return liters * 1000;
  }

  static cubicCentimetersToLiters(cc: number): number {
    return cc / 1000;
  }

  static millimetersToCentimeters(mm: number): number {
    return mm / 10;
  }

  static centimetersToMillimeters(cm: number): number {
    return cm * 10;
  }

  static squareCentimetersToSquareMeters(cm2: number): number {
    return cm2 / 10000;
  }

  static squareMetersToSquareCentimeters(m2: number): number {
    return m2 * 10000;
  }

  static kilogramsToGrams(kg: number): number {
    return kg * 1000;
  }

  static gramsToKilograms(g: number): number {
    return g / 1000;
  }

  static celsiusToFahrenheit(c: number): number {
    return (c * 9/5) + 32;
  }

  static fahrenheitToCelsius(f: number): number {
    return (f - 32) * 5/9;
  }

  static kmhToMs(kmh: number): number {
    return kmh / 3.6;
  }

  static msToKmh(ms: number): number {
    return ms * 3.6;
  }

  static normalizePercentage(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  static normalizeVolume(value: number): number {
    return Math.max(0, value);
  }

  static mmToLitersPerSquareMeter(mm: number): number {
    return mm;
  }

  static calculatePotVolume(diameter: number, height: number): number {
    const radius = diameter / 2;
    const volume = Math.PI * radius * radius * height;
    return this.cubicCentimetersToLiters(volume);
  }

  static calculateSurfaceArea(diameter: number): number {
    const radius = diameter / 2;
    return Math.PI * radius * radius;
  }

  static waterAmountToVolume(waterAmount: number, surfaceArea: number): number {
    const depthCm = waterAmount / 10;
    const volumeCC = surfaceArea * depthCm;
    return this.cubicCentimetersToLiters(volumeCC);
  }

  static volumeToWaterAmount(volume: number, surfaceArea: number): number {
    const volumeCC = this.litersToCubicCentimeters(volume);
    const depthCm = volumeCC / surfaceArea;
    return this.centimetersToMillimeters(depthCm);
  }
}
