export class StorageManager {
  constructor() {
    this.storageKey = 'parking_cctv_sandbox';
    this.autoSaveInterval = null;
    this.autoSaveDelay = 30000;
  }

  save(sceneRenderer) {
    const data = this.serializeScene(sceneRenderer);
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    console.log('场景已保存到本地存储');
    return data;
  }

  load(sceneRenderer) {
    const savedData = localStorage.getItem(this.storageKey);
    if (!savedData) {
      console.log('没有找到保存的场景数据');
      return null;
    }

    try {
      const data = JSON.parse(savedData);
      this.deserializeScene(sceneRenderer, data);
      console.log('场景已从本地存储加载');
      return data;
    } catch (error) {
      console.error('加载场景失败:', error);
      return null;
    }
  }

  serializeScene(sceneRenderer) {
    const { walls, pillars, cameras, parkings, passages } = sceneRenderer.objects;

    return {
      version: '1.0',
      timestamp: Date.now(),
      walls: walls.map(w => this.serializeWall(w)),
      pillars: pillars.map(p => this.serializePillar(p)),
      cameras: cameras.map(c => this.serializeCamera(c)),
      parkings: parkings.map(p => this.serializeParking(p)),
      passages: passages.map(p => this.serializePassage(p))
    };
  }

  serializeWall(wall) {
    return {
      id: wall.id,
      position: {
        x: wall.data.position.x,
        z: wall.data.position.z
      },
      width: wall.data.width,
      height: wall.data.height,
      depth: wall.data.depth,
      rotation: wall.data.rotation || 0
    };
  }

  serializePillar(pillar) {
    return {
      id: pillar.id,
      position: {
        x: pillar.data.position.x,
        z: pillar.data.position.z
      },
      radius: pillar.data.radius,
      height: pillar.data.height
    };
  }

  serializeCamera(camera) {
    return {
      id: camera.id,
      position: {
        x: camera.data.position.x,
        z: camera.data.position.z
      },
      rotation: {
        x: camera.data.rotation?.x || 0,
        y: camera.data.rotation?.y || 0,
        z: camera.data.rotation?.z || 0
      },
      fov: camera.data.fov || 60,
      aspect: camera.data.aspect || 16/9,
      near: camera.data.near || 0.1,
      far: camera.data.far || 50,
      height: camera.data.height || 3,
      name: camera.data.name || ''
    };
  }

  serializeParking(parking) {
    return {
      id: parking.id,
      position: {
        x: parking.data.position.x,
        z: parking.data.position.z
      },
      width: parking.data.width,
      depth: parking.data.depth,
      rotation: parking.data.rotation || 0,
      label: parking.data.label || ''
    };
  }

  serializePassage(passage) {
    return {
      id: passage.id,
      position: {
        x: passage.data.position.x,
        z: passage.data.position.z
      },
      width: passage.data.width,
      depth: passage.data.depth,
      rotation: passage.data.rotation || 0,
      isCritical: passage.data.isCritical || false,
      name: passage.data.name || ''
    };
  }

  deserializeScene(sceneRenderer, data) {
    sceneRenderer.clearScene();

    if (data.walls) {
      for (const wallData of data.walls) {
        sceneRenderer.createWall({
          id: wallData.id,
          position: { x: wallData.position.x, z: wallData.position.z },
          width: wallData.width,
          height: wallData.height,
          depth: wallData.depth,
          rotation: wallData.rotation
        });
      }
    }

    if (data.pillars) {
      for (const pillarData of data.pillars) {
        sceneRenderer.createPillar({
          id: pillarData.id,
          position: { x: pillarData.position.x, z: pillarData.position.z },
          radius: pillarData.radius,
          height: pillarData.height
        });
      }
    }

    if (data.cameras) {
      for (const cameraData of data.cameras) {
        sceneRenderer.createCamera({
          id: cameraData.id,
          position: { x: cameraData.position.x, z: cameraData.position.z },
          rotation: cameraData.rotation || { x: 0, y: 0, z: 0 },
          fov: cameraData.fov,
          aspect: cameraData.aspect,
          near: cameraData.near,
          far: cameraData.far,
          height: cameraData.height,
          name: cameraData.name
        });
      }
    }

    if (data.parkings) {
      for (const parkingData of data.parkings) {
        sceneRenderer.createParking({
          id: parkingData.id,
          position: { x: parkingData.position.x, z: parkingData.position.z },
          width: parkingData.width,
          depth: parkingData.depth,
          rotation: parkingData.rotation,
          label: parkingData.label
        });
      }
    }

    if (data.passages) {
      for (const passageData of data.passages) {
        sceneRenderer.createPassage({
          id: passageData.id,
          position: { x: passageData.position.x, z: passageData.position.z },
          width: passageData.width,
          depth: passageData.depth,
          rotation: passageData.rotation,
          isCritical: passageData.isCritical,
          name: passageData.name
        });
      }
    }
  }

  exportJSON(sceneRenderer) {
    const data = this.serializeScene(sceneRenderer);
    return JSON.stringify(data, null, 2);
  }

  importJSON(sceneRenderer, jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.deserializeScene(sceneRenderer, data);
      return true;
    } catch (error) {
      console.error('导入JSON失败:', error);
      return false;
    }
  }

  startAutoSave(sceneRenderer) {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      this.save(sceneRenderer);
    }, this.autoSaveDelay);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  hasSavedData() {
    return localStorage.getItem(this.storageKey) !== null;
  }

  clearSavedData() {
    localStorage.removeItem(this.storageKey);
  }

  getSavedTimestamp() {
    const savedData = localStorage.getItem(this.storageKey);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        return data.timestamp;
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

export default StorageManager;
