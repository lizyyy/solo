export const sampleData = {
  version: '1.0',
  timestamp: Date.now(),
  walls: [
    {
      id: 'wall-1',
      position: { x: 0, z: -25 },
      width: 60,
      height: 3,
      depth: 0.5,
      rotation: 0
    },
    {
      id: 'wall-2',
      position: { x: 0, z: 25 },
      width: 60,
      height: 3,
      depth: 0.5,
      rotation: 0
    },
    {
      id: 'wall-3',
      position: { x: -30, z: 0 },
      width: 50,
      height: 3,
      depth: 0.5,
      rotation: Math.PI / 2
    },
    {
      id: 'wall-4',
      position: { x: 30, z: 0 },
      width: 50,
      height: 3,
      depth: 0.5,
      rotation: Math.PI / 2
    },
    {
      id: 'wall-5',
      position: { x: 0, z: 0 },
      width: 20,
      height: 3,
      depth: 0.5,
      rotation: 0
    }
  ],
  pillars: [
    {
      id: 'pillar-1',
      position: { x: -20, z: -15 },
      radius: 0.5,
      height: 3
    },
    {
      id: 'pillar-2',
      position: { x: -20, z: 15 },
      radius: 0.5,
      height: 3
    },
    {
      id: 'pillar-3',
      position: { x: 20, z: -15 },
      radius: 0.5,
      height: 3
    },
    {
      id: 'pillar-4',
      position: { x: 20, z: 15 },
      radius: 0.5,
      height: 3
    },
    {
      id: 'pillar-5',
      position: { x: 0, z: -15 },
      radius: 0.6,
      height: 3
    },
    {
      id: 'pillar-6',
      position: { x: 0, z: 15 },
      radius: 0.6,
      height: 3
    }
  ],
  cameras: [
    {
      id: 'cam-1',
      position: { x: -25, z: -20 },
      rotation: { x: -0.5, y: 0.785, z: 0 },
      fov: 90,
      aspect: 16/9,
      near: 0.1,
      far: 40,
      height: 3.5,
      name: '入口摄像头-1'
    },
    {
      id: 'cam-2',
      position: { x: 25, z: -20 },
      rotation: { x: -0.5, y: 2.356, z: 0 },
      fov: 90,
      aspect: 16/9,
      near: 0.1,
      far: 40,
      height: 3.5,
      name: '入口摄像头-2'
    },
    {
      id: 'cam-3',
      position: { x: -25, z: 20 },
      rotation: { x: -0.5, y: -0.785, z: 0 },
      fov: 90,
      aspect: 16/9,
      near: 0.1,
      far: 40,
      height: 3.5,
      name: '出口摄像头-1'
    },
    {
      id: 'cam-4',
      position: { x: 25, z: 20 },
      rotation: { x: -0.5, y: -2.356, z: 0 },
      fov: 90,
      aspect: 16/9,
      near: 0.1,
      far: 40,
      height: 3.5,
      name: '出口摄像头-2'
    },
    {
      id: 'cam-5',
      position: { x: 0, z: 0 },
      rotation: { x: -0.8, y: 0, z: 0 },
      fov: 120,
      aspect: 16/9,
      near: 0.1,
      far: 25,
      height: 4,
      name: '中央全景摄像头'
    }
  ],
  parkings: [
    {
      id: 'parking-1',
      position: { x: -15, z: -18 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'A01'
    },
    {
      id: 'parking-2',
      position: { x: -15, z: -14 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'A02'
    },
    {
      id: 'parking-3',
      position: { x: -15, z: -10 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'A03'
    },
    {
      id: 'parking-4',
      position: { x: -15, z: -6 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'A04'
    },
    {
      id: 'parking-5',
      position: { x: 15, z: -18 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'B01'
    },
    {
      id: 'parking-6',
      position: { x: 15, z: -14 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'B02'
    },
    {
      id: 'parking-7',
      position: { x: 15, z: -10 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'B03'
    },
    {
      id: 'parking-8',
      position: { x: 15, z: -6 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'B04'
    },
    {
      id: 'parking-9',
      position: { x: -15, z: 6 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'C01'
    },
    {
      id: 'parking-10',
      position: { x: -15, z: 10 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'C02'
    },
    {
      id: 'parking-11',
      position: { x: -15, z: 14 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'C03'
    },
    {
      id: 'parking-12',
      position: { x: -15, z: 18 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: 'C04'
    },
    {
      id: 'parking-13',
      position: { x: 15, z: 6 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'D01'
    },
    {
      id: 'parking-14',
      position: { x: 15, z: 10 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'D02'
    },
    {
      id: 'parking-15',
      position: { x: 15, z: 14 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'D03'
    },
    {
      id: 'parking-16',
      position: { x: 15, z: 18 },
      width: 5,
      depth: 2.5,
      rotation: Math.PI,
      label: 'D04'
    }
  ],
  passages: [
    {
      id: 'passage-1',
      position: { x: -8, z: -12 },
      width: 8,
      depth: 25,
      rotation: 0,
      isCritical: true,
      name: '左主通道'
    },
    {
      id: 'passage-2',
      position: { x: 8, z: -12 },
      width: 8,
      depth: 25,
      rotation: 0,
      isCritical: true,
      name: '右主通道'
    },
    {
      id: 'passage-3',
      position: { x: 0, z: 0 },
      width: 40,
      depth: 8,
      rotation: 0,
      isCritical: true,
      name: '中央横通道'
    },
    {
      id: 'passage-4',
      position: { x: 0, z: -22 },
      width: 40,
      depth: 4,
      rotation: 0,
      isCritical: true,
      name: '入口通道'
    },
    {
      id: 'passage-5',
      position: { x: 0, z: 22 },
      width: 40,
      depth: 4,
      rotation: 0,
      isCritical: true,
      name: '出口通道'
    }
  ]
};

export const loadSampleData = (sceneRenderer) => {
  sceneRenderer.clearScene();

  sampleData.walls.forEach(wall => {
    sceneRenderer.createWall({
      id: wall.id,
      position: { x: wall.position.x, z: wall.position.z },
      width: wall.width,
      height: wall.height,
      depth: wall.depth,
      rotation: wall.rotation
    });
  });

  sampleData.pillars.forEach(pillar => {
    sceneRenderer.createPillar({
      id: pillar.id,
      position: { x: pillar.position.x, z: pillar.position.z },
      radius: pillar.radius,
      height: pillar.height
    });
  });

  sampleData.cameras.forEach(camera => {
    sceneRenderer.createCamera({
      id: camera.id,
      position: { x: camera.position.x, z: camera.position.z },
      rotation: camera.rotation,
      fov: camera.fov,
      aspect: camera.aspect,
      near: camera.near,
      far: camera.far,
      height: camera.height,
      name: camera.name
    });
  });

  sampleData.parkings.forEach(parking => {
    sceneRenderer.createParking({
      id: parking.id,
      position: { x: parking.position.x, z: parking.position.z },
      width: parking.width,
      depth: parking.depth,
      rotation: parking.rotation,
      label: parking.label
    });
  });

  sampleData.passages.forEach(passage => {
    sceneRenderer.createPassage({
      id: passage.id,
      position: { x: passage.position.x, z: passage.position.z },
      width: passage.width,
      depth: passage.depth,
      rotation: passage.rotation,
      isCritical: passage.isCritical,
      name: passage.name
    });
  });

  return sampleData;
};

export default {
  sampleData,
  loadSampleData
};
