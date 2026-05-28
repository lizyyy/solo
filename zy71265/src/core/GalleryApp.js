import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { DataManager } from './DataManager.js';
import { AnimationController } from './AnimationController.js';
import { UIController } from './UIController.js';
import { ReportExporter } from './ReportExporter.js';
import { generateSampleData } from '../data/sampleData.js';
import { VISUAL_MODES, GALLERY_DIMENSIONS } from '../utils/constants.js';
import { getHeatmapColorHex } from '../utils/helpers.js';

export class GalleryApp {
  constructor() {
    this.sceneManager = null;
    this.dataManager = new DataManager();
    this.animationController = null;
    this.uiController = null;
    this.reportExporter = null;
    
    this.currentRecord = null;
    this.highlightedArtworks = [];
    this.activeFloor = null;
    this.visualMode = VISUAL_MODES.COMBINED;
    this.congestionMarkers = [];
    this.issueMarkers = [];
    
    this.showCongestion = true;
    this.showIssues = true;
    this.heatmapOpacity = 0.6;
    this.heatmapRadius = 2.5;
  }

  init() {
    const container = document.getElementById('canvas-container');
    
    this.sceneManager = new SceneManager(container);
    this.animationController = new AnimationController(this.sceneManager);
    this.uiController = new UIController(this);
    this.reportExporter = new ReportExporter(this.dataManager);

    this.sceneManager.init();
    this.uiController.init();

    this.sceneManager.onObjectClick = (artworkData) => {
      this.toggleArtworkHighlight(artworkData.id);
      this.uiController.updateArtworkList();
    };

    this.loadSampleDataIfEmpty();
    
    window.addEventListener('resize', () => this.onResize());
  }

  async loadSampleDataIfEmpty() {
    if (this.dataManager.records.length === 0) {
      const sampleData = generateSampleData();
      this.dataManager.createRecord(sampleData, 'gallery-sample-data.json');
      this.dataManager.saveToStorage();
    }
    
    this.loadCurrentRecord();
    this.uiController.updateRecordDisplay();
  }

  loadCurrentRecord() {
    const record = this.dataManager.getCurrentRecord();
    if (!record) return;

    this.currentRecord = record;
    this.highlightedArtworks = [];
    
    this.sceneManager.clearArtworks();
    this.sceneManager.clearVisitors();
    this.sceneManager.clearHeatmap();
    this.clearCongestionMarkers();
    this.clearIssueMarkers();

    const filteredArtworks = this.dataManager.getFilteredArtworks(record, record.filters);
    filteredArtworks.forEach(artwork => {
      this.sceneManager.addArtwork(artwork);
    });

    this.updateHeatmap();
    this.updateCongestionPoints();
    this.updateIssueMarkers();

    const filteredVisitors = this.dataManager.getFilteredVisitors(record, record.filters);
    
    const visitorsWithColor = filteredVisitors.map(v => ({
      ...v,
      batchColor: record.batches.find(b => b.id === v.batch)?.color || 0x667eea
    }));

    this.animationController.setVisitors(visitorsWithColor);
    this.uiController.updateTimelineDisplay();
  }

  setViewMode(mode) {
    this.sceneManager.setViewMode(mode);
  }

  setVisualMode(mode) {
    this.visualMode = mode;
    this.updateHeatmap();
    this.updateVisitorsVisibility();
  }

  setActiveFloor(floor) {
    this.activeFloor = floor;
    
    if (floor === null) {
      this.sceneManager.setFloorOpacity(999, 1);
    } else {
      this.sceneManager.setFloorOpacity(floor, 0.3);
    }
    
    this.updateHeatmap();
    this.updateCongestionPoints();
  }

  setLabelsVisible(visible) {
    this.sceneManager.setLabelsVisible(visible);
  }

  setGridVisible(visible) {
    this.sceneManager.setGridVisible(visible);
  }

  setCongestionVisible(visible) {
    this.showCongestion = visible;
    this.congestionMarkers.forEach(marker => {
      marker.visible = visible;
    });
  }

  setIssuesVisible(visible) {
    this.showIssues = visible;
    this.issueMarkers.forEach(marker => {
      marker.visible = visible;
    });
  }

  setHeatmapOpacity(opacity) {
    this.heatmapOpacity = opacity;
    if (this.sceneManager.objects.heatmap) {
      this.sceneManager.objects.heatmap.material.opacity = opacity;
    }
  }

  setHeatmapRadius(radius) {
    this.heatmapRadius = radius;
    this.updateHeatmap();
  }

  updateHeatmap() {
    if (!this.currentRecord) return;

    if (this.visualMode === VISUAL_MODES.NORMAL || this.visualMode === VISUAL_MODES.PATH) {
      this.sceneManager.clearHeatmap();
      return;
    }

    let heatmapData = this.currentRecord.heatmapData;
    
    if (this.activeFloor !== null) {
      heatmapData = heatmapData.filter(d => d.floor === this.activeFloor);
    }

    if (this.currentRecord.filters.selectedBatches.length > 0) {
      const filteredVisitors = this.dataManager.getFilteredVisitors(this.currentRecord, this.currentRecord.filters);
      heatmapData = this.regenerateHeatmap(filteredVisitors);
    }

    if (heatmapData.length > 0) {
      const floor = this.activeFloor || 1;
      this.sceneManager.createHeatmap(heatmapData, floor);
      this.sceneManager.objects.heatmap.material.opacity = this.heatmapOpacity;
    }
  }

  regenerateHeatmap(visitors) {
    const { width, depth } = GALLERY_DIMENSIONS;
    const gridSize = 1;
    const grid = {};

    for (const visitor of visitors) {
      for (let i = 0; i < visitor.path.length; i++) {
        const p = visitor.path[i];
        if (this.activeFloor !== null && p.floor !== this.activeFloor) continue;
        
        const gridX = Math.floor((p.x + width / 2) / gridSize);
        const gridZ = Math.floor((p.z + depth / 2) / gridSize);
        const key = `${gridX},${gridZ},${p.floor}`;
        
        if (!grid[key]) {
          grid[key] = { x: p.x, z: p.z, floor: p.floor, value: 0, duration: 0 };
        }
        
        grid[key].value += 1;
        
        if (i > 0) {
          grid[key].duration += (p.timestamp - visitor.path[i-1].timestamp) / 1000;
        }
      }
    }

    return Object.values(grid);
  }

  updateVisitorsVisibility() {
    const showPaths = this.visualMode === VISUAL_MODES.PATH || this.visualMode === VISUAL_MODES.COMBINED;
    this.sceneManager.objects.visitors.forEach((visitor) => {
      visitor.mesh.visible = showPaths;
      visitor.trail.visible = showPaths;
    });
  }

  updateCongestionPoints() {
    if (!this.currentRecord) return;

    this.clearCongestionMarkers();

    if (!this.showCongestion) return;

    let points = this.currentRecord.congestionPoints;
    
    if (this.activeFloor !== null) {
      points = points.filter(p => p.floor === this.activeFloor);
    }

    const { height } = GALLERY_DIMENSIONS;

    points.forEach(cp => {
      const floorY = (cp.floor - 1) * height;
      
      const color = cp.severity === 'high' ? 0xef4444 : cp.severity === 'medium' ? 0xf59e0b : 0x22c55e;
      
      const geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(cp.x, floorY + 0.05, cp.z);
      
      const ringGeometry = new THREE.RingGeometry(1.5, 2.5, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = floorY + 0.02;
      marker.add(ring);

      const pulseGeometry = new THREE.RingGeometry(0.5, 0.7, 16);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.rotation.x = -Math.PI / 2;
      pulse.position.y = floorY + 0.1;
      marker.add(pulse);

      marker.userData.congestionData = cp;
      marker.userData.isPulse = pulse;
      marker.userData.baseScale = 1;

      this.sceneManager.scene.add(marker);
      this.congestionMarkers.push(marker);
    });

    this.animateCongestionMarkers();
  }

  animateCongestionMarkers() {
    const animate = () => {
      const time = Date.now() * 0.003;
      this.congestionMarkers.forEach(marker => {
        if (marker.userData.isPulse) {
          const scale = 1 + Math.sin(time) * 0.3;
          marker.userData.isPulse.scale.set(scale, scale, scale);
          marker.userData.isPulse.material.opacity = 0.5 + Math.sin(time) * 0.3;
        }
      });
      requestAnimationFrame(animate);
    };
    animate();
  }

  clearCongestionMarkers() {
    this.congestionMarkers.forEach(marker => {
      this.sceneManager.scene.remove(marker);
    });
    this.congestionMarkers = [];
  }

  updateIssueMarkers() {
    if (!this.currentRecord) return;

    this.clearIssueMarkers();

    if (!this.showIssues) return;

    const { height } = GALLERY_DIMENSIONS;
    const issues = this.currentRecord.issues;

    issues.biases.forEach(bias => {
      const artwork = this.currentRecord.artworks.find(a => a.id === bias.artworkId);
      if (!artwork) return;
      if (this.activeFloor !== null && artwork.floor !== this.activeFloor) return;

      const floorY = ((artwork.floor || 1) - 1) * height;
      
      const geometry = new THREE.SphereGeometry(0.3, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.8
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(
        artwork.x,
        floorY + 4,
        artwork.z
      );
      
      this.sceneManager.scene.add(marker);
      this.issueMarkers.push(marker);
    });
  }

  clearIssueMarkers() {
    this.issueMarkers.forEach(marker => {
      this.sceneManager.scene.remove(marker);
    });
    this.issueMarkers = [];
  }

  toggleArtworkHighlight(artworkId) {
    const index = this.highlightedArtworks.indexOf(artworkId);
    if (index === -1) {
      this.highlightedArtworks.push(artworkId);
    } else {
      this.highlightedArtworks.splice(index, 1);
    }

    this.sceneManager.objects.artworks.forEach((artwork, id) => {
      const isHighlighted = this.highlightedArtworks.includes(id);
      const material = artwork.mesh.material;
      
      if (isHighlighted) {
        material.emissive.setHex(0xfbbf24);
        material.emissiveIntensity = 0.5;
        artwork.group.scale.set(1.1, 1.1, 1.1);
      } else {
        const originalColor = artwork.data.color || 0x8b5cf6;
        material.emissive.setHex(originalColor);
        material.emissiveIntensity = 0.1;
        artwork.group.scale.set(1, 1, 1);
      }
    });
  }

  toggleBatchFilter(batchId, selected) {
    if (!this.currentRecord) return;

    const filters = this.currentRecord.filters;
    const index = filters.selectedBatches.indexOf(batchId);
    
    if (selected) {
      if (index === -1) {
        filters.selectedBatches.push(batchId);
      }
    } else {
      if (index !== -1) {
        filters.selectedBatches.splice(index, 1);
      }
    }

    this.dataManager.updateRecord(this.currentRecord.id, { filters });
    this.loadCurrentRecord();
  }

  focusArtwork(artworkId) {
    const artwork = this.sceneManager.objects.artworks.get(artworkId);
    if (!artwork) return;

    const position = artwork.group.position.clone();
    position.y += 2;
    position.x += 5;
    position.z += 5;

    this.sceneManager.camera.position.copy(position);
    this.sceneManager.controls.target.copy(artwork.group.position);
    this.sceneManager.controls.update();

    if (!this.highlightedArtworks.includes(artworkId)) {
      this.toggleArtworkHighlight(artworkId);
      this.uiController.updateArtworkList();
    }
  }

  focusVisitor(visitorId) {
    const visitor = this.currentRecord?.visitors.find(v => v.id === visitorId);
    if (!visitor || visitor.path.length === 0) return;

    const firstPoint = visitor.path[0];
    const position = new THREE.Vector3(
      firstPoint.x + 5,
      firstPoint.y + 3,
      firstPoint.z + 5
    );

    this.sceneManager.camera.position.copy(position);
    this.sceneManager.controls.target.set(firstPoint.x, firstPoint.y, firstPoint.z);
    this.sceneManager.controls.update();

    this.uiController.showToast(`已定位到访客 ${visitorId.slice(0, 8)}...`, 'info');
  }

  exportReport(format, name, options) {
    return this.reportExporter.export(format, name, options);
  }

  onResize() {
    if (this.sceneManager) {
      this.sceneManager.resize();
    }
  }

  dispose() {
    if (this.sceneManager) {
      this.sceneManager.dispose();
    }
    if (this.animationController) {
      this.animationController.dispose();
    }
  }
}
