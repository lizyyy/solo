import * as THREE from 'three';
import { ExhibitionElement, ElementType } from '../types';

const COLORS: Record<ElementType, number> = {
  exhibit: 0xFF9800,
  entrance: 0x4CAF50,
  exit: 0x2196F3,
  restricted: 0x9E9E9E,
  obstacle: 0x795548,
};

const TRANSPARENCY: Record<ElementType, number> = {
  exhibit: 1.0,
  entrance: 0.6,
  exit: 0.6,
  restricted: 0.4,
  obstacle: 1.0,
};

export interface VisualElement {
  element: ExhibitionElement;
  mesh: THREE.Mesh;
  group: THREE.Group;
}

function createLabel(text: string, color: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  const fontSize = 24;
  
  canvas.width = 256;
  canvas.height = 64;
  
  context.font = `bold ${fontSize}px Arial`;
  context.fillStyle = '#FFFFFF';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    color: color,
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);
  
  return sprite as unknown as THREE.Mesh;
}

export function createElementMesh(element: ExhibitionElement): VisualElement {
  const group = new THREE.Group();
  group.name = element.id;
  group.userData = { element };

  const width = element.dimensions.width;
  const depth = element.dimensions.depth;
  const height = element.dimensions.height;

  let mesh: THREE.Mesh;
  const color = COLORS[element.type];
  const opacity = TRANSPARENCY[element.type];

  if (element.type === 'entrance' || element.type === 'exit' || element.type === 'restricted') {
    const planeGeometry = new THREE.PlaneGeometry(width, depth);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: color,
      transparent: opacity < 1.0,
      opacity: opacity,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.01;
    plane.userData = { element, isPlane: true };
    
    const boxGeometry = new THREE.BoxGeometry(width, 0.1, depth);
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: color,
      transparent: opacity < 1.0,
      opacity: opacity * 0.5,
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.y = 0.05;
    box.userData = { element };
    
    mesh = plane;
    group.add(plane);
    group.add(box);
  } else {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.7,
    });
    
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = height / 2;
    mesh.userData = { element };
    
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ 
      color: 0x000000,
      linewidth: 2,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.y = height / 2;
    edges.userData = { element };
    
    group.add(mesh);
    group.add(edges);
  }

  if (element.name) {
    const label = createLabel(element.name, color);
    label.position.y = height + 0.5;
    label.userData = { element, isLabel: true };
    group.add(label);
  }

  group.position.set(
    element.position.x,
    element.position.y || 0,
    element.position.z
  );

  if (element.rotation) {
    group.rotation.y = element.rotation * (Math.PI / 180);
  }

  group.castShadow = true;
  group.receiveShadow = true;

  return {
    element,
    mesh,
    group,
  };
}

export function createFloor(width: number, depth: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width + 2, depth + 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2C3E50,
    roughness: 0.8,
    metalness: 0.2,
  });

  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.name = 'floor';

  return floor;
}

export function createGrid(width: number, depth: number, gridSize: number = 1): THREE.Group {
  const group = new THREE.Group();
  group.name = 'grid';

  const gridHelper1 = new THREE.GridHelper(
    Math.max(width, depth) + 4,
    Math.floor(Math.max(width, depth) / gridSize),
    0x444444,
    0x333333
  );
  gridHelper1.position.y = 0.001;
  group.add(gridHelper1);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x34495E,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });

  const wallHeight = 3;
  const wallThickness = 0.1;

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(width + 4, wallHeight, wallThickness),
    wallMaterial
  );
  backWall.position.set(0, wallHeight / 2, -depth / 2 - 2);
  group.add(backWall);

  const frontWall = new THREE.Mesh(
    new THREE.BoxGeometry(width + 4, wallHeight, wallThickness),
    wallMaterial
  );
  frontWall.position.set(0, wallHeight / 2, depth / 2 + 2);
  group.add(frontWall);

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, depth + 4),
    wallMaterial
  );
  leftWall.position.set(-width / 2 - 2, wallHeight / 2, 0);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, depth + 4),
    wallMaterial
  );
  rightWall.position.set(width / 2 + 2, wallHeight / 2, 0);
  group.add(rightWall);

  return group;
}

export function updateElementPosition(
  visualElement: VisualElement,
  position: { x: number; z: number }
): void {
  visualElement.element.position.x = position.x;
  visualElement.element.position.z = position.z;
  
  visualElement.group.position.x = position.x;
  visualElement.group.position.z = position.z;
}

export function highlightElement(visualElement: VisualElement, highlighted: boolean): void {
  const color = highlighted ? 0xFFFF00 : COLORS[visualElement.element.type];
  
  visualElement.group.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.isLabel) {
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.emissive = new THREE.Color(highlighted ? 0x333300 : 0x000000);
          }
        });
      } else if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive = new THREE.Color(highlighted ? 0x333300 : 0x000000);
      }
    }
  });
}

export function createVisitorMarker(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0xE91E63,
    metalness: 0.1,
    roughness: 0.8,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.3;
  mesh.castShadow = true;
  
  return mesh;
}
