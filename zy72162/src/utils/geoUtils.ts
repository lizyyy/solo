export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  }
  return `${(meters / 1000).toFixed(1)}公里`;
}

export function parseCoordinates(str: string): { lat: number; lng: number } | null {
  const patterns = [
    /^([-\d.]+)[,，\s]+([-\d.]+)$/,
    /^([-\d.]+)°?\s*([NS])?[,，\s]+([-\d.]+)°?\s*([EW])?$/i,
  ];
  
  for (const pattern of patterns) {
    const match = str.trim().match(pattern);
    if (match) {
      let lat = parseFloat(match[1]);
      let lng = parseFloat(match[2]);
      
      if (match[3] && match[4]) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[3]);
        if (match[2]?.toUpperCase() === 'S') lat = -lat;
        if (match[4]?.toUpperCase() === 'W') lng = -lng;
      }
      
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
