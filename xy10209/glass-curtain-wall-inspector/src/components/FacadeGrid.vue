<script setup lang="ts">
import { computed } from 'vue';
import { useInspectorStore } from '../stores/inspectorStore';
import { DefectType } from '../types';

const store = useInspectorStore();

const gridCells = computed(() => {
  const building = store.selectedBuilding;
  if (!building) return [];
  
  const cells = [];
  for (let floor = building.floors; floor >= 1; floor--) {
    for (let col = 1; col <= building.columns; col++) {
      cells.push({ floor, column: col });
    }
  }
  return cells;
});

const getCellClass = (floor: number, column: number) => {
  const hasDefect = store.hasDefectAt(floor, column);
  const defectType = store.getPrimaryDefectType(floor, column);
  
  const classes = ['grid-cell'];
  if (hasDefect) {
    classes.push('has-defect');
    if (defectType === DefectType.CRACK) {
      classes.push('defect-crack');
    } else if (defectType === DefectType.LOOSENESS) {
      classes.push('defect-looseness');
    }
  }
  return classes.join(' ');
};

const handleCellClick = (floor: number, column: number) => {
  console.log(`[点击] 网格单元: ${floor}F-${column}列`);
  const defects = store.getDefectsAtPosition(floor, column);
  if (defects.length > 0) {
    store.selectDefect(defects[0]);
  } else {
    emit('createDefect', { floor, column });
  }
};

const emit = defineEmits<{
  (e: 'createDefect', position: { floor: number; column: number }): void;
}>();
</script>

<template>
  <div class="facade-grid">
    <div class="grid-header">
      <span class="floor-label">楼层</span>
      <div class="column-labels">
        <span v-for="col in (store.selectedBuilding?.columns || 0)" :key="col" class="col-label">
          {{ col }}列
        </span>
      </div>
    </div>
    
    <div class="grid-body">
      <div class="floor-labels">
        <span v-for="floor in (store.selectedBuilding?.floors || 0)" :key="floor" class="floor-tag">
          {{ store.selectedBuilding ? (store.selectedBuilding.floors - floor + 1) : floor }}F
        </span>
      </div>
      
      <div 
        class="grid-container"
        :style="{
          gridTemplateColumns: `repeat(${store.selectedBuilding?.columns || 1}, minmax(40px, 1fr))`,
          gridTemplateRows: `repeat(${store.selectedBuilding?.floors || 1}, minmax(40px, 1fr))`
        }"
      >
        <div
          v-for="cell in gridCells"
          :key="`${cell.floor}-${cell.column}`"
          :class="getCellClass(cell.floor, cell.column)"
          :data-floor="cell.floor"
          :data-column="cell.column"
          @click="handleCellClick(cell.floor, cell.column)"
        >
          <span v-if="store.hasDefectAt(cell.floor, cell.column)" class="defect-indicator">
            {{ store.getDefectsAtPosition(cell.floor, cell.column).length }}
          </span>
        </div>
      </div>
    </div>
    
    <div class="grid-legend">
      <div class="legend-item">
        <span class="legend-color normal"></span>
        <span>正常</span>
      </div>
      <div class="legend-item">
        <span class="legend-color defect-crack"></span>
        <span>裂纹</span>
      </div>
      <div class="legend-item">
        <span class="legend-color defect-looseness"></span>
        <span>松动</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facade-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
}

.grid-header {
  display: flex;
  gap: 8px;
}

.floor-label {
  width: 50px;
  font-size: 12px;
  color: var(--text, #6b6375);
  display: flex;
  align-items: center;
  justify-content: center;
}

.column-labels {
  flex: 1;
  display: flex;
  gap: 2px;
}

.col-label {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--text, #6b6375);
  padding: 4px 0;
}

.grid-body {
  display: flex;
  gap: 8px;
}

.floor-labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 50px;
}

.floor-tag {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text, #6b6375);
  font-weight: 500;
}

.grid-container {
  flex: 1;
  display: grid;
  gap: 2px;
}

.grid-cell {
  aspect-ratio: 1;
  background: #e8f4fd;
  border: 1px solid #bcd7f0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.grid-cell:hover {
  background: #d1e7f8;
  border-color: #7fb3e0;
  transform: scale(1.05);
  z-index: 10;
}

.grid-cell.has-defect {
  cursor: pointer;
}

.grid-cell.defect-crack {
  background: linear-gradient(135deg, #ffe5e5 0%, #ffcccc 100%);
  border-color: #e57373;
}

.grid-cell.defect-crack:hover {
  background: linear-gradient(135deg, #ffd1d1 0%, #ffb3b3 100%);
}

.grid-cell.defect-looseness {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-color: #ffb74d;
}

.grid-cell.defect-looseness:hover {
  background: linear-gradient(135deg, #ffe8cc 0%, #ffcc99 100%);
}

.defect-indicator {
  background: var(--accent, #aa3bff);
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.grid-legend {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e4e7);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text, #6b6375);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--border, #e5e4e7);
}

.legend-color.normal {
  background: #e8f4fd;
  border-color: #bcd7f0;
}

.legend-color.defect-crack {
  background: linear-gradient(135deg, #ffe5e5 0%, #ffcccc 100%);
  border-color: #e57373;
}

.legend-color.defect-looseness {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-color: #ffb74d;
}
</style>
