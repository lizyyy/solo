import { kml } from '@tmcw/togeojson';
import { Coordinate, RouteData } from '../types';

export function parseKML(kmlText: string): RouteData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const geoJSON = kml(xmlDoc);

  let coordinates: Coordinate[] = [];
  let name = '未命名航线';

  const placemark = geoJSON.features?.[0];
  if (placemark) {
    name = (placemark.properties?.name as string) || '未命名航线';

    const geometry = placemark.geometry;
    if (geometry.type === 'LineString') {
      coordinates = geometry.coordinates.map(([lng, lat, alt]) => ({
        lat,
        lng,
        alt: alt ?? 100,
      }));
    } else if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line) => {
        line.forEach(([lng, lat, alt]) => {
          coordinates.push({
            lat,
            lng,
            alt: alt ?? 100,
          });
        });
      });
    }
  }

  return {
    name,
    coordinates,
    description: placemark?.properties?.description as string | undefined,
  };
}

export function generateKML(routeData: RouteData): string {
  const coords = routeData.coordinates
    .map((c) => `${c.lng},${c.lat},${c.alt}`)
    .join('\n            ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${routeData.name}</name>
    ${routeData.description ? `<description>${routeData.description}</description>` : ''}
    <Placemark>
      <name>${routeData.name}</name>
      <Style>
        <LineStyle>
          <color>ff0099ff</color>
          <width>3</width>
        </LineStyle>
      </Style>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>
            ${coords}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

export function generateSampleKML(routeName: string, centerLat: number, centerLng: number, points: number = 8): string {
  const coordinates: Coordinate[] = [];
  const radius = 0.01;

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    coordinates.push({
      lat: centerLat + Math.sin(angle) * radius,
      lng: centerLng + Math.cos(angle) * radius,
      alt: 80 + Math.random() * 40,
    });
  }
  coordinates.push(coordinates[0]);

  return generateKML({
    name: routeName,
    coordinates,
    description: `自动生成的航线 - ${routeName}`,
  });
}

export function modifyKML(originalKML: string, modifier: (coords: Coordinate[]) => Coordinate[]): string {
  const routeData = parseKML(originalKML);
  const modifiedCoords = modifier(routeData.coordinates);
  return generateKML({
    ...routeData,
    coordinates: modifiedCoords,
  });
}
