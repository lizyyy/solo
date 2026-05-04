<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import L from 'leaflet';

const props = defineProps({
  flightPath: {
    type: Array,
    default: () => []
  },
  restrictedZones: {
    type: Object,
    default: () => ({ type: 'FeatureCollection', features: [] })
  },
  risks: {
    type: Array,
    default: () => []
  }
});

const mapContainer = ref(null);
let map = null;
let flightPathLayer = null;
let waypointLayers = [];
let restrictedZoneLayers = [];

const initMap = () => {
  if (!mapContainer.value) return;

  map = L.map(mapContainer.value).setView([39.9042, 116.4074], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  updateMap();
};

const updateMap = () => {
  if (!map) return;

  if (flightPathLayer) {
    map.removeLayer(flightPathLayer);
    flightPathLayer = null;
  }

  waypointLayers.forEach(layer => map.removeLayer(layer));
  waypointLayers = [];

  restrictedZoneLayers.forEach(layer => map.removeLayer(layer));
  restrictedZoneLayers = [];

  const bounds = [];

  if (props.flightPath && props.flightPath.length > 0) {
    const latLngs = props.flightPath.map(point => [point.latitude, point.longitude]);
    latLngs.forEach(ll => bounds.push(ll));

    flightPathLayer = L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.8
    }).addTo(map);

    props.flightPath.forEach((point, index) => {
      const isFirst = index === 0;
      const isLast = index === props.flightPath.length - 1;
      
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: isFirst || isLast ? 8 : 5,
        fillColor: isFirst ? '#10b981' : (isLast ? '#ef4444' : '#3b82f6'),
        color: '#fff',
        weight: 2,
        fillOpacity: 1
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 150px;">
          <strong>${isFirst ? '🚀 起飞点' : (isLast ? '🪂 降落点' : `📍 航点 ${index + 1}`)}</strong><br/>
          纬度: ${point.latitude.toFixed(6)}°<br/>
          经度: ${point.longitude.toFixed(6)}°<br/>
          高度: ${(point.altitude || 0).toFixed(1)} 米
        </div>
      `);

      waypointLayers.push(marker);
    });
  }

  if (props.restrictedZones?.features?.length > 0) {
    props.restrictedZones.features.forEach(feature => {
      const zoneType = feature.properties?._zoneType || 'restricted';
      const zoneName = feature.properties?._name || '限制区';
      const maxAlt = feature.properties?._maxAltitude;

      let fillColor, borderColor, fillOpacity;
      
      if (zoneType === 'no_fly') {
        fillColor = '#ef4444';
        borderColor = '#dc2626';
        fillOpacity = 0.3;
      } else if (zoneType === 'height_limit') {
        fillColor = '#f59e0b';
        borderColor = '#d97706';
        fillOpacity = 0.25;
      } else {
        fillColor = '#6b7280';
        borderColor = '#4b5563';
        fillOpacity = 0.2;
      }

      let layer;
      if (feature.geometry.type === 'Polygon') {
        layer = L.polygon(
          feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]),
          {
            fillColor,
            color: borderColor,
            fillOpacity,
            weight: 2
          }
        ).addTo(map);
      } else if (feature.geometry.type === 'MultiPolygon') {
        const polygons = feature.geometry.coordinates.map(polygon => 
          polygon[0].map(coord => [coord[1], coord[0]])
        );
        layer = L.polygon(polygons, {
          fillColor,
          color: borderColor,
          fillOpacity,
          weight: 2
        }).addTo(map);
      }

      if (layer) {
        layer.bindPopup(`
          <div style="min-width: 150px;">
            <strong>🚫 ${zoneName}</strong><br/>
            类型: ${zoneType === 'no_fly' ? '禁飞区' : (zoneType === 'height_limit' ? '限高区' : '限制区')}<br/>
            ${maxAlt !== undefined ? `限制高度: ${maxAlt} 米<br/>` : ''}
          </div>
        `);

        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach(coord => {
            bounds.push([coord[1], coord[0]]);
          });
        }

        restrictedZoneLayers.push(layer);
      }
    });
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
};

watch(() => [props.flightPath, props.restrictedZones], () => {
  nextTick(() => {
    updateMap();
  });
}, { deep: true });

onMounted(() => {
  nextTick(() => {
    initMap();
  });
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
