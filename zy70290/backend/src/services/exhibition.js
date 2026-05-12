import { v4 as uuidv4 } from 'uuid';
import store from '../store.js';
import { STAGES, updateBusinessStatus, updateDataSummary, addProblem } from '../utils/status.js';

const DEFAULT_EXHIBITIONS = [
  {
    name: '古代书画展区',
    description: '展示中国古代书画精品',
    boundingBox: { x: 50, y: 50, width: 200, height: 200 },
    priority: 'high',
    expectedDuration: 180
  },
  {
    name: '现代艺术展区',
    description: '当代艺术作品展示区',
    boundingBox: { x: 300, y: 50, width: 200, height: 200 },
    priority: 'medium',
    expectedDuration: 150
  },
  {
    name: '雕塑展区',
    description: '雕塑艺术展示区',
    boundingBox: { x: 550, y: 50, width: 200, height: 200 },
    priority: 'medium',
    expectedDuration: 120
  },
  {
    name: '摄影展区',
    description: '摄影艺术作品展示',
    boundingBox: { x: 50, y: 300, width: 200, height: 200 },
    priority: 'low',
    expectedDuration: 90
  },
  {
    name: '交互体验区',
    description: '观众互动体验区',
    boundingBox: { x: 300, y: 300, width: 200, height: 200 },
    priority: 'high',
    expectedDuration: 240
  }
];

function createExhibition(data) {
  const exhibition = {
    id: uuidv4(),
    name: data.name,
    description: data.description || '',
    boundingBox: data.boundingBox,
    priority: data.priority || 'medium',
    expectedDuration: data.expectedDuration || 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const overlapCheck = checkBoundingBoxOverlap(exhibition.boundingBox);
  if (overlapCheck.overlaps) {
    addProblem(
      'exhibition_overlap', 
      'warning', 
      'exhibition_management', 
      `新展区"${exhibition.name}"与现有展区重叠: ${overlapCheck.overlappingExhibitions.join(', ')}`,
      { newExhibition: exhibition, overlapping: overlapCheck.overlappingExhibitions }
    );
  }
  
  store.exhibitions.push(exhibition);
  updateDataSummary();
  
  checkReadinessForHeatmap();
  
  return exhibition;
}

function checkBoundingBoxOverlap(newBox, excludeId = null) {
  const overlapping = [];
  
  for (const exhibition of store.exhibitions) {
    if (excludeId && exhibition.id === excludeId) continue;
    
    const box = exhibition.boundingBox;
    if (boxesOverlap(newBox, box)) {
      overlapping.push(exhibition.name);
    }
  }
  
  return {
    overlaps: overlapping.length > 0,
    overlappingExhibitions: overlapping
  };
}

function boxesOverlap(box1, box2) {
  return !(box1.x + box1.width <= box2.x || 
           box2.x + box2.width <= box1.x || 
           box1.y + box1.height <= box2.y || 
           box2.y + box2.height <= box1.y);
}

function updateExhibition(id, data) {
  const index = store.exhibitions.findIndex(e => e.id === id);
  if (index === -1) {
    addProblem('exhibition_not_found', 'error', 'exhibition_management', `展区不存在: ${id}`, { id });
    return null;
  }
  
  const existing = store.exhibitions[index];
  
  if (data.boundingBox) {
    const overlapCheck = checkBoundingBoxOverlap(data.boundingBox, id);
    if (overlapCheck.overlaps) {
      addProblem(
        'exhibition_overlap', 
        'warning', 
        'exhibition_management', 
        `展区"${existing.name}"更新后与其他展区重叠: ${overlapCheck.overlappingExhibitions.join(', ')}`,
        { exhibitionId: id, newBox: data.boundingBox, overlapping: overlapCheck.overlappingExhibitions }
      );
    }
  }
  
  store.exhibitions[index] = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString()
  };
  
  updateDataSummary();
  return store.exhibitions[index];
}

function deleteExhibition(id) {
  const index = store.exhibitions.findIndex(e => e.id === id);
  if (index === -1) {
    addProblem('exhibition_not_found', 'error', 'exhibition_management', `删除失败，展区不存在: ${id}`, { id });
    return false;
  }
  
  const deleted = store.exhibitions.splice(index, 1)[0];
  addProblem(
    'exhibition_deleted', 
    'info', 
    'exhibition_management', 
    `展区已删除: ${deleted.name}`,
    { deletedExhibition: deleted }
  );
  
  updateDataSummary();
  checkReadinessForHeatmap();
  
  return true;
}

function getExhibitions() {
  return store.exhibitions;
}

function getExhibitionById(id) {
  return store.exhibitions.find(e => e.id === id) || null;
}

function checkReadinessForHeatmap() {
  const validPoints = store.stopPoints.filter(p => p.status === 'valid');
  const hasExhibitions = store.exhibitions.length > 0;
  
  if (validPoints.length > 0 && hasExhibitions) {
    updateBusinessStatus(
      STAGES.EXHIBITION_GROUPING, 
      null, 
      [
        `当前有 ${validPoints.length} 条有效停留点数据`,
        `已配置 ${store.exhibitions.length} 个展区`,
        '可以开始热区计算了'
      ]
    );
  } else if (validPoints.length === 0) {
    updateBusinessStatus(
      STAGES.DATA_IMPORT, 
      'no_valid_data', 
      ['没有可用的有效停留点数据，请先导入数据']
    );
  } else if (!hasExhibitions) {
    updateBusinessStatus(
      STAGES.EXHIBITION_GROUPING, 
      'no_exhibitions', 
      ['需要至少配置一个展区才能进行热区计算']
    );
  }
}

function initDefaultExhibitions() {
  if (store.exhibitions.length === 0) {
    for (const def of DEFAULT_EXHIBITIONS) {
      createExhibition(def);
    }
    updateBusinessStatus(
      STAGES.EXHIBITION_GROUPING,
      null,
      ['已初始化默认展区分组，请根据实际展厅布局调整']
    );
  }
}

export {
  createExhibition,
  updateExhibition,
  deleteExhibition,
  getExhibitions,
  getExhibitionById,
  checkReadinessForHeatmap,
  initDefaultExhibitions
};
