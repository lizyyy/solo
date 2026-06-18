export function detectCoordReversal(lat: number, lng: number): { reversed: boolean; reason: string } {
  if (Math.abs(lat) > 90) {
    return { reversed: true, reason: `纬度值 ${lat} 超出有效范围 [-90, 90]` }
  }
  if (Math.abs(lng) > 180) {
    return { reversed: true, reason: `经度值 ${lng} 超出有效范围 [-180, 180]` }
  }
  if (lat >= 116 && lat <= 135) {
    return { reversed: true, reason: `纬度值 ${lat} 落在中国海域经度范围 [116, 135]，疑似经纬度反写` }
  }
  return { reversed: false, reason: '' }
}

export function isCoordSuspicious(lat: number, lng: number): boolean {
  return detectCoordReversal(lat, lng).reversed
}
