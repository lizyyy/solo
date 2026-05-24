import { Building, WindowUnit, Orientation } from '../types';

export const SAMPLE_BUILDINGS: Building[] = [
  {
    id: 'building-a',
    name: 'A栋（被投诉楼）',
    position: [0, 0, 0],
    dimensions: { width: 30, height: 60, depth: 15 },
    floors: 20,
    color: '#64748b',
  },
  {
    id: 'building-b',
    name: 'B栋（南侧遮挡）',
    position: [0, 0, -50],
    dimensions: { width: 40, height: 70, depth: 15 },
    floors: 24,
    color: '#475569',
  },
  {
    id: 'building-c',
    name: 'C栋（东南遮挡）',
    position: [40, 0, -40],
    dimensions: { width: 35, height: 55, depth: 15 },
    floors: 18,
    color: '#334155',
  },
  {
    id: 'building-d',
    name: 'D栋（西南遮挡）',
    position: [-35, 0, -45],
    dimensions: { width: 30, height: 50, depth: 12 },
    floors: 16,
    color: '#1e293b',
  },
];

const generateWindowsForBuilding = (building: Building): WindowUnit[] => {
  const windows: WindowUnit[] = [];
  const { id: buildingId, position, dimensions, floors } = building;
  const floorHeight = dimensions.height / floors;
  const windowWidth = 2;
  const windowHeight = floorHeight * 0.6;
  
  const orientations: { face: Orientation; offsetX: number; offsetZ: number; normalX: number; normalZ: number }[] = [
    { face: 'south', offsetX: 0, offsetZ: -dimensions.depth / 2 - 0.1, normalX: 0, normalZ: -1 },
    { face: 'north', offsetX: 0, offsetZ: dimensions.depth / 2 + 0.1, normalX: 0, normalZ: 1 },
    { face: 'east', offsetX: dimensions.width / 2 + 0.1, offsetZ: 0, normalX: 1, normalZ: 0 },
    { face: 'west', offsetX: -dimensions.width / 2 - 0.1, offsetZ: 0, normalX: -1, normalZ: 0 },
  ];

  orientations.forEach(({ face, offsetX, offsetZ }) => {
    const isHorizontalFace = face === 'south' || face === 'north';
    const faceLength = isHorizontalFace ? dimensions.width : dimensions.depth;
    const windowsPerFloor = Math.floor(faceLength / 4);
    
    for (let floor = 1; floor <= floors; floor++) {
      for (let w = 0; w < windowsPerFloor; w++) {
        const unitNumber = `${floor}${String.fromCharCode(65 + w)}`;
        const windowId = `${buildingId}-${face}-${floor}-${w}`;
        
        let windowPosX: number, windowPosZ: number;
        
        if (isHorizontalFace) {
          windowPosX = position[0] - faceLength / 2 + (w + 0.5) * (faceLength / windowsPerFloor);
          windowPosZ = position[2] + offsetZ;
        } else {
          windowPosX = position[0] + offsetX;
          windowPosZ = position[2] - faceLength / 2 + (w + 0.5) * (faceLength / windowsPerFloor);
        }
        
        windows.push({
          id: windowId,
          buildingId,
          floor,
          unitNumber,
          position: [
            windowPosX,
            position[1] + (floor - 0.5) * floorHeight,
            windowPosZ,
          ],
          size: { width: windowWidth, height: windowHeight },
          orientation: face,
        });
      }
    }
  });

  return windows;
};

export const SAMPLE_WINDOWS: WindowUnit[] = SAMPLE_BUILDINGS.flatMap(generateWindowsForBuilding);

export const COMPLAINT_WINDOWS = [
  'building-a-south-3-0',
  'building-a-south-3-1',
  'building-a-south-4-0',
  'building-a-south-4-1',
  'building-a-south-5-0',
];
