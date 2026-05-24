import { useState, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Shelf, SkuSlot } from '../../types';
import { Sku3D } from './Sku3D';
import { useAppStore } from '../../store/appStore';

interface Shelf3DProps {
  shelf: Shelf;
  showGoldenLayer: boolean;
  filterCategory: string | null;
  selectedSkuSlotId: string | null;
  issueSlotIds: Set<string>;
}

export function Shelf3D({
  shelf,
  showGoldenLayer,
  filterCategory,
  selectedSkuSlotId,
  issueSlotIds,
}: Shelf3DProps) {
  const [hovered, setHovered] = useState(false);
  const setSelectedShelf = useAppStore((state) => state.setSelectedShelf);
  const selectedShelfId = useAppStore((state) => state.selectedShelfId);
  const draggedSku = useAppStore((state) => state.draggedSku);
  const moveSku = useAppStore((state) => state.moveSku);

  const isSelected = selectedShelfId === shelf.id;

  const frameColor = shelf.isEndcap ? '#6366f1' : '#4a5568';
  const selectedColor = '#fbbf24';

  const filteredSlots = useMemo(() => {
    return shelf.layers.map((layer) => ({
      ...layer,
      slots: layer.slots.filter(
        (slot) => !filterCategory || slot.category === filterCategory
      ),
    }));
  }, [shelf.layers, filterCategory]);

  const handleShelfClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedShelf(shelf.id);

    if (draggedSku) {
      const targetLayer = shelf.layers.find((l) => l.isGolden) || shelf.layers[2];
      const emptyPosition = targetLayer.slots.findIndex((s) => s.isOutOfStock);
      const insertPosition = emptyPosition >= 0 ? emptyPosition : targetLayer.slots.length;
      
      moveSku(
        draggedSku.shelfId,
        draggedSku.layerIndex,
        draggedSku.slotId,
        shelf.id,
        targetLayer.index,
        insertPosition
      );
    }
  };

  const handlePointerOver = () => {
    setHovered(true);
    if (!draggedSku) {
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = draggedSku ? 'copy' : 'auto';
  };

  return (
    <group
      position={[shelf.x, 0, shelf.z]}
      rotation={[0, shelf.rotation, 0]}
      onClick={handleShelfClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh position={[0, shelf.height / 2, 0]}>
        <boxGeometry args={[shelf.width + 0.1, shelf.height + 0.1, shelf.depth + 0.1]} />
        <meshBasicMaterial
          color={isSelected ? selectedColor : hovered ? '#666666' : frameColor}
          transparent
          opacity={0.1}
        />
      </mesh>

      {filteredSlots.map((layer) => (
        <group key={`layer-${layer.index}`}>
          <mesh position={[0, layer.height, 0]}>
            <boxGeometry args={[shelf.width, 0.05, shelf.depth]} />
            <meshStandardMaterial
              color={showGoldenLayer && layer.isGolden ? '#fbbf24' : '#555555'}
              metalness={0.3}
              roughness={0.7}
            />
          </mesh>

          {showGoldenLayer && layer.isGolden && (
            <mesh position={[0, layer.height + 0.02, 0]}>
              <boxGeometry args={[shelf.width + 0.1, 0.02, shelf.depth + 0.1]} />
              <meshBasicMaterial
                color="#fbbf24"
                transparent
                opacity={0.3}
              />
            </mesh>
          )}

          <mesh position={[0, layer.height + 0.01, shelf.depth / 2 - 0.01]}>
            <boxGeometry args={[shelf.width, 0.1, 0.02]} />
            <meshStandardMaterial
              color={showGoldenLayer && layer.isGolden ? '#d97706' : '#444444'}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>

          {layer.slots.map((slot: SkuSlot) => (
            <Sku3D
              key={slot.id}
              slot={slot}
              shelfId={shelf.id}
              layerIndex={layer.index}
              layerHeight={layer.height}
              shelfWidth={shelf.width}
              shelfDepth={shelf.depth}
              isSelected={selectedSkuSlotId === slot.id}
              hasIssue={issueSlotIds.has(slot.id)}
            />
          ))}
        </group>
      ))}

      <mesh position={[-shelf.width / 2 - 0.02, shelf.height / 2, 0]}>
        <boxGeometry args={[0.04, shelf.height, shelf.depth]} />
        <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[shelf.width / 2 + 0.02, shelf.height / 2, 0]}>
        <boxGeometry args={[0.04, shelf.height, shelf.depth]} />
        <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.5} />
      </mesh>

      {shelf.isEndcap && (
        <mesh position={[0, shelf.height + 0.3, 0]}>
          <boxGeometry args={[shelf.width, 0.3, 0.05]} />
          <meshBasicMaterial color="#6366f1" />
        </mesh>
      )}

      {shelf.isBlocked && (
        <mesh position={[0, shelf.height / 2, -shelf.depth - 0.5]}>
          <boxGeometry args={[shelf.width, shelf.height, 0.5]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}
