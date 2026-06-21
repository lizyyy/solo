import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  BimNote,
  CollisionPoint,
  MaterialChange,
  BimComponent,
  CameraView,
  TrackingStatus,
  ChangeImpactResult,
  AuditLog,
} from '../types';
import {
  mockBimNotes,
  mockCollisions,
  mockMaterialChanges,
  mockBimComponents,
  mockAuditLogs,
} from '../data/mockData';
import { analyzeChangeImpact } from '../utils/impactAnalysis';

interface AppState {
  bimNotes: BimNote[];
  collisions: CollisionPoint[];
  materialChanges: MaterialChange[];
  bimComponents: BimComponent[];
  auditLogs: AuditLog[];
  currentCameraView: CameraView;
  selectedCollisionId: string | null;
  selectedBimNoteId: string | null;
  selectedMaterialChangeId: string | null;
  lastImpactResult: ChangeImpactResult | null;
}

type AppAction =
  | { type: 'ADD_BIM_NOTE'; payload: BimNote }
  | { type: 'UPDATE_BIM_NOTE'; payload: BimNote }
  | { type: 'DELETE_BIM_NOTE'; payload: { id: string; reason: string } }
  | { type: 'ADD_COLLISION'; payload: CollisionPoint }
  | { type: 'UPDATE_COLLISION'; payload: CollisionPoint }
  | { type: 'CONFIRM_DUPLICATE'; payload: { collisionId: string; isDuplicate: boolean } }
  | { type: 'ADD_MATERIAL_CHANGE'; payload: MaterialChange }
  | { type: 'UPDATE_MATERIAL_CHANGE'; payload: MaterialChange }
  | { type: 'UPDATE_MATERIAL_STATUS'; payload: { id: string; status: TrackingStatus } }
  | { type: 'SET_CAMERA_VIEW'; payload: CameraView }
  | { type: 'SELECT_COLLISION'; payload: string | null }
  | { type: 'SELECT_BIM_NOTE'; payload: string | null }
  | { type: 'SELECT_MATERIAL_CHANGE'; payload: string | null }
  | { type: 'SET_IMPACT_RESULT'; payload: ChangeImpactResult | null }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLog }
  | { type: 'PROCESS_NEW_NOTE_IMPACT'; payload: { bimNote: BimNote } };

const initialState: AppState = {
  bimNotes: mockBimNotes,
  collisions: mockCollisions,
  materialChanges: mockMaterialChanges,
  bimComponents: mockBimComponents,
  auditLogs: mockAuditLogs,
  currentCameraView: {
    position: { x: 100, y: -50, z: 50 },
    rotation: { x: -30, y: 45, z: 0 },
    zoom: 1.0,
  },
  selectedCollisionId: null,
  selectedBimNoteId: null,
  selectedMaterialChangeId: null,
  lastImpactResult: null,
};

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_BIM_NOTE':
      return {
        ...state,
        bimNotes: [...state.bimNotes, action.payload],
      };

    case 'UPDATE_BIM_NOTE':
      return {
        ...state,
        bimNotes: state.bimNotes.map((n) =>
          n.id === action.payload.id ? action.payload : n
        ),
      };

    case 'DELETE_BIM_NOTE':
      return {
        ...state,
        bimNotes: state.bimNotes.map((n) =>
          n.id === action.payload.id
            ? { ...n, isDeleted: true, deletedReason: action.payload.reason, updatedAt: new Date().toISOString() }
            : n
        ),
      };

    case 'ADD_COLLISION':
      return {
        ...state,
        collisions: [...state.collisions, action.payload],
      };

    case 'UPDATE_COLLISION':
      return {
        ...state,
        collisions: state.collisions.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };

    case 'CONFIRM_DUPLICATE': {
      const { collisionId, isDuplicate } = action.payload;
      const collision = state.collisions.find((c) => c.id === collisionId);
      if (!collision) return state;

      const updatedCollisions = state.collisions.map((c) => {
        if (c.id === collisionId) {
          return {
            ...c,
            isDuplicate,
            needsManualReview: false,
            status: isDuplicate ? 'confirmed' as TrackingStatus : c.status,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      let updatedMaterialChanges = [...state.materialChanges];
      if (isDuplicate && collision.duplicateOf) {
        updatedMaterialChanges = updatedMaterialChanges.map((mc) => {
          if (mc.collisionPointIds.includes(collisionId)) {
            const newIds = mc.collisionPointIds.filter((id) => id !== collisionId);
            if (!newIds.includes(collision.duplicateOf!)) {
              newIds.push(collision.duplicateOf!);
            }
            const summary = generateUnifiedSummary(mc, updatedCollisions.filter(c => newIds.includes(c.id)));
            return {
              ...mc,
              collisionPointIds: newIds,
              ...summary,
              updatedAt: new Date().toISOString(),
            };
          }
          return mc;
        });
      }

      return {
        ...state,
        collisions: updatedCollisions,
        materialChanges: updatedMaterialChanges,
      };
    }

    case 'ADD_MATERIAL_CHANGE':
      return {
        ...state,
        materialChanges: [...state.materialChanges, action.payload],
      };

    case 'UPDATE_MATERIAL_CHANGE':
      return {
        ...state,
        materialChanges: state.materialChanges.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
      };

    case 'UPDATE_MATERIAL_STATUS':
      return {
        ...state,
        materialChanges: state.materialChanges.map((m) =>
          m.id === action.payload.id
            ? { ...m, status: action.payload.status, updatedAt: new Date().toISOString() }
            : m
        ),
      };

    case 'SET_CAMERA_VIEW':
      return {
        ...state,
        currentCameraView: action.payload,
      };

    case 'SELECT_COLLISION':
      return {
        ...state,
        selectedCollisionId: action.payload,
      };

    case 'SELECT_BIM_NOTE':
      return {
        ...state,
        selectedBimNoteId: action.payload,
      };

    case 'SELECT_MATERIAL_CHANGE':
      return {
        ...state,
        selectedMaterialChangeId: action.payload,
      };

    case 'SET_IMPACT_RESULT':
      return {
        ...state,
        lastImpactResult: action.payload,
      };

    case 'ADD_AUDIT_LOG':
      return {
        ...state,
        auditLogs: [...state.auditLogs, action.payload],
      };

    case 'PROCESS_NEW_NOTE_IMPACT': {
      const { bimNote } = action.payload;
      const impact = analyzeChangeImpact(bimNote, state.collisions, state.materialChanges, state.bimComponents);

      const newCollisions = impact.newCollisions.map((c) => ({
        ...c,
        id: generateId('col'),
        bimNoteId: bimNote.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      let updatedMaterialChanges = [...state.materialChanges];
      if (impact.affectedMaterialChanges.length > 0) {
        updatedMaterialChanges = updatedMaterialChanges.map((mc) => {
          if (impact.affectedMaterialChanges.includes(mc.id)) {
            const newCollisionIds = [...mc.collisionPointIds, ...newCollisions.map((c) => c.id)];
            const relatedCollisions = [...state.collisions, ...newCollisions].filter((c) =>
              newCollisionIds.includes(c.id)
            );
            const summary = generateUnifiedSummary(mc, relatedCollisions);
            return {
              ...mc,
              collisionPointIds: newCollisionIds,
              changedJudgements: [...mc.changedJudgements, ...impact.newJudgements],
              ...summary,
              updatedAt: new Date().toISOString(),
            };
          }
          return mc;
        });
      }

      const newMaterialChange: MaterialChange = {
        id: generateId('mc'),
        title: `${bimNote.title} - 材料变更`,
        description: bimNote.content.slice(0, 100) + '...',
        bimNoteId: bimNote.id,
        collisionPointIds: newCollisions.map((c) => c.id),
        sceneAnnotation: impact.updatedSceneAnnotation,
        sideNote: impact.updatedSideNote,
        pageSummary: impact.updatedPageSummary,
        status: 'pending',
        materials: [],
        changedJudgements: impact.newJudgements,
        author: bimNote.author,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBadData: false,
      };

      return {
        ...state,
        collisions: [...state.collisions, ...newCollisions],
        materialChanges: [...updatedMaterialChanges, newMaterialChange],
        lastImpactResult: {
          ...impact,
          newCollisions,
        },
      };
    }

    default:
      return state;
  }
}

function generateUnifiedSummary(
  mc: MaterialChange,
  collisions: CollisionPoint[]
): { sceneAnnotation: string; sideNote: string; pageSummary: string } {
  const validCollisions = collisions.filter((c) => !c.isDuplicate || c.needsManualReview);
  const duplicateCount = collisions.filter((c) => c.isDuplicate).length;
  const needsReviewCount = collisions.filter((c) => c.needsManualReview).length;

  const sceneAnnotation = `${mc.title}，涉及${validCollisions.length}个碰撞点${
    duplicateCount > 0 ? `（含${duplicateCount}个疑似重复）` : ''
  }，调整后管线路由示意。`;

  const sideNote = `本变更涉及${mc.materials.length}项材料。碰撞点${validCollisions.length}个${
    duplicateCount > 0 ? `，其中${duplicateCount}个疑似重复需人工确认` : ''
  }${needsReviewCount > 0 ? `，${needsReviewCount}个需人工复核` : ''}。${mc.description}`;

  const confirmedCount = collisions.filter((c) => c.status === 'confirmed').length;
  const pendingCount = collisions.filter((c) => c.status === 'pending').length;
  const pageSummary = `${mc.title}共涉及${mc.materials.length}项材料，${validCollisions.length}个碰撞点。已确认${confirmedCount}个，待确认${pendingCount}个${
    duplicateCount > 0 ? `，${duplicateCount}个重复待人工确认` : ''
  }。当前状态：${getStatusLabel(mc.status)}。`;

  return { sceneAnnotation, sideNote, pageSummary };
}

function getStatusLabel(status: TrackingStatus): string {
  const labels: Record<TrackingStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    supplement: '待补件',
    returned: '已退回',
    bad_data: '坏数据',
    needs_review: '需复核',
  };
  return labels[status] || status;
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
