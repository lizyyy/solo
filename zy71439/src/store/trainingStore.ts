import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BearingData,
  PositionMark,
  SelectedRoute,
  GeoPoint,
  Lighthouse,
  Scenario,
  RouteOption,
  OperationType,
  OperationLog,
  TrainingRecord,
  TriangleData,
  WorkflowStatus
} from '../types';
import { LIGHTHOUSES } from '../data/lighthouses';
import { getScenarioById, getRandomScenario } from '../data/scenarios';
import { calculateDistance } from '../utils/geoCalculations';
import { estimatePosition } from '../utils/triangulation';

export interface TrainingState {
  currentRecordId: string | null;
  traineeName: string;
  scenario: Scenario | null;
  lighthouses: Lighthouse[];
  bearings: Record<string, BearingData>;
  positionMark: (PositionMark & { point: GeoPoint; snappedToEstimate: boolean }) | null;
  selectedRoute: (SelectedRoute & RouteOption) | null;
  routeOptions: RouteOption[];
  estimatedPosition: GeoPoint | null;
  triangleData: TriangleData | null;
  decisionReason: string;
  isSubmitted: boolean;
  operations: OperationLog[];
  startTime: Date | null;

  setTraineeName: (name: string) => void;
  setScenario: (scenarioId: string, lighthouseIds: string[]) => void;
  startNewTraining: () => void;
  loadScenario: (scenarioId: string) => void;
  setBearing: (lighthouseId: string, bearing: Partial<BearingData>) => void;
  setPositionMark: (position: { point: GeoPoint }, snapped?: boolean) => void;
  adjustPositionMark: (position: GeoPoint) => void;
  setSelectedRoute: (route: RouteOption, reason: string) => void;
  setDecisionReason: (reason: string) => void;
  setEstimatedPosition: (position: GeoPoint | null) => void;
  generateRouteOptions: () => void;
  resetTraining: () => void;
  markAsSubmitted: () => void;
  addOperation: (actionType: OperationType, detail: string, details?: Record<string, any>, hasUnitError?: boolean) => void;
  toTrainingRecord: () => Omit<TrainingRecord, 'traineeName' | 'finalError' | 'workflow'>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      currentRecordId: null,
      traineeName: '学员',
      scenario: null,
      lighthouses: LIGHTHOUSES,
      bearings: {},
      positionMark: null,
      selectedRoute: null,
      routeOptions: [],
      estimatedPosition: null,
      triangleData: null,
      decisionReason: '',
      isSubmitted: false,
      operations: [],
      startTime: null,

      setTraineeName: (name) => set({ traineeName: name }),

      setScenario: (scenarioId, lighthouseIds) => {
        const scenario = getScenarioById(scenarioId);
        if (!scenario) return;

        const recordId = generateId();
        const scenarioLighthouses = LIGHTHOUSES.filter(lh =>
          lighthouseIds.includes(lh.id)
        );

        set({
          currentRecordId: recordId,
          scenario,
          lighthouses: scenarioLighthouses,
          startTime: new Date(),
          operations: []
        });
      },

      startNewTraining: () => {
        const scenario = getRandomScenario();
        const recordId = generateId();
        const scenarioLighthouses = LIGHTHOUSES.filter(lh =>
          scenario.lighthouseIds.includes(lh.id)
        );

        set({
          currentRecordId: recordId,
          scenario,
          lighthouses: scenarioLighthouses,
          bearings: {},
          positionMark: null,
          selectedRoute: null,
          routeOptions: [],
          estimatedPosition: null,
          triangleData: null,
          decisionReason: '',
          isSubmitted: false,
          operations: [],
          startTime: new Date()
        });

        get().addOperation(
          OperationType.BEARING_INPUT,
          `开始训练：${scenario.name}`
        );
      },

      loadScenario: (scenarioId) => {
        const scenario = getScenarioById(scenarioId);
        if (!scenario) return;

        const recordId = generateId();
        const scenarioLighthouses = LIGHTHOUSES.filter(lh =>
          scenario.lighthouseIds.includes(lh.id)
        );

        set({
          currentRecordId: recordId,
          scenario,
          lighthouses: scenarioLighthouses,
          bearings: {},
          positionMark: null,
          selectedRoute: null,
          routeOptions: [],
          estimatedPosition: null,
          triangleData: null,
          decisionReason: '',
          isSubmitted: false,
          operations: [],
          startTime: new Date()
        });

        get().addOperation(
          OperationType.BEARING_INPUT,
          `开始训练：${scenario.name}`
        );
      },

      setBearing: (lighthouseId, bearing) => {
        const existing = get().bearings[lighthouseId];
        const now = new Date();
        const lighthouseName = get().lighthouses.find(lh => lh.id === lighthouseId)?.name || lighthouseId;

        if (existing) {
          const oldDecimal = existing.decimalDegrees;
          const newDecimal = bearing.decimalDegrees ?? oldDecimal;

          const newBearing: BearingData = {
            ...existing,
            ...bearing,
            decimalDegrees: newDecimal,
            modifyHistory: [
              ...existing.modifyHistory,
              {
                timestamp: now,
                oldValue: oldDecimal,
                newValue: newDecimal
              }
            ]
          };

          set({
            bearings: {
              ...get().bearings,
              [lighthouseId]: newBearing
            }
          });

          get().addOperation(
            OperationType.BEARING_MODIFY,
            `修改 ${lighthouseName} 方位角`,
            {
              灯塔: lighthouseName,
              原值: `${oldDecimal.toFixed(2)}°`,
              新值: `${newDecimal.toFixed(2)}°`
            },
            bearing.hasUnitError
          );
        } else {
          const newBearing: BearingData = {
            lighthouseId,
            degrees: bearing.degrees ?? 0,
            minutes: bearing.minutes ?? 0,
            seconds: bearing.seconds ?? 0,
            decimalDegrees: bearing.decimalDegrees ?? 0,
            unit: bearing.unit ?? 'decimal',
            hasUnitError: bearing.hasUnitError ?? false,
            inputTime: now,
            source: 'manual_input',
            modifyHistory: []
          };

          set({
            bearings: {
              ...get().bearings,
              [lighthouseId]: newBearing
            }
          });

          get().addOperation(
            OperationType.BEARING_INPUT,
            `输入 ${lighthouseName} 方位角`,
            {
              灯塔: lighthouseName,
              方位角: `${newBearing.decimalDegrees.toFixed(2)}°`,
              单位: newBearing.unit === 'dms' ? '度分秒' : '十进制度'
            },
            newBearing.hasUnitError
          );

          if (newBearing.hasUnitError) {
            get().addOperation(
              OperationType.UNIT_ERROR_DETECTED,
              `${lighthouseName} 方位角单位可能有误`,
              {
                灯塔: lighthouseName,
                输入值: `${newBearing.decimalDegrees.toFixed(2)}°`,
                提示: '请确认是否混淆了度分秒与十进制度'
              },
              true
            );
          }
        }

        const bearings = Object.values(get().bearings);
        if (bearings.length >= 3) {
          const result = estimatePosition(get().lighthouses, get().bearings);
          set({
            estimatedPosition: result.position,
            triangleData: result.triangle
          });
        }
      },

      setPositionMark: (position, snapped = false) => {
        const now = new Date();
        const mark = {
          id: generateId(),
          position: position.point,
          point: position.point,
          snappedToEstimate: snapped,
          confidence: 0.8,
          markedTime: now,
          adjustHistory: []
        };

        set({ positionMark: mark });

        get().addOperation(
          OperationType.POSITION_MARK,
          `标注遇险船位置：${position.point.lat.toFixed(4)}°N, ${position.point.lng.toFixed(4)}°E`,
          {
            纬度: position.point.lat.toFixed(6),
            经度: position.point.lng.toFixed(6),
            磁力吸附: snapped ? '是' : '否'
          }
        );
      },

      adjustPositionMark: (position) => {
        const existing = get().positionMark;
        if (!existing) return;

        const now = new Date();
        const updated = {
          ...existing,
          position,
          point: position,
          adjustHistory: [
            ...existing.adjustHistory,
            {
              timestamp: now,
              oldPosition: existing.position,
              newPosition: position
            }
          ]
        };

        set({ positionMark: updated });

        get().addOperation(
          OperationType.POSITION_ADJUST,
          `调整位置至：${position.lat.toFixed(4)}°N, ${position.lng.toFixed(4)}°E`,
          {
            纬度: position.lat.toFixed(6),
            经度: position.lng.toFixed(6)
          }
        );
      },

      setSelectedRoute: (route, reason) => {
        const now = new Date();
        const selected = {
          ...route,
          routeId: route.id,
          decisionReason: reason,
          selectedTime: now
        };

        set({
          selectedRoute: selected,
          decisionReason: reason
        });

        get().addOperation(
          OperationType.ROUTE_SELECT,
          `选择路线：${route.name}`,
          {
            路线: route.name,
            距离: `${(route.distance / 1852).toFixed(2)}海里`,
            预计时间: `${route.estimatedTime}分钟`,
            风险等级: route.riskLevel === 'low' ? '低' : route.riskLevel === 'medium' ? '中' : '高',
            选择理由: reason
          }
        );
      },

      setDecisionReason: (reason) => set({ decisionReason: reason }),

      setEstimatedPosition: (position) => set({ estimatedPosition: position }),

      generateRouteOptions: () => {
        const { positionMark, scenario } = get();
        if (!positionMark || !scenario) return;

        const start = scenario.rescueStation;
        const end = positionMark.position;

        const routeOptions: RouteOption[] = [
          {
            id: 'route-direct',
            name: '直达航线',
            start,
            end,
            waypoints: [],
            distance: calculateDistance(start, end),
            estimatedTime: Math.round(calculateDistance(start, end) / 15 / 1.852),
            riskLevel: 'medium',
            riskDescription: '直线距离最短，但需穿越渔船密集区'
          },
          {
            id: 'route-safety',
            name: '安全航线',
            start,
            end,
            waypoints: [
              { lat: (start.lat + end.lat) / 2 + 0.005, lng: (start.lng + end.lng) / 2 - 0.005 }
            ],
            distance: calculateDistance(start, end) * 1.15,
            estimatedTime: Math.round(calculateDistance(start, end) * 1.15 / 12 / 1.852),
            riskLevel: 'low',
            riskDescription: '绕行避开危险区域，安全性最高'
          },
          {
            id: 'route-fast',
            name: '快速航线',
            start,
            end,
            waypoints: [
              { lat: (start.lat + end.lat) / 2 - 0.003, lng: (start.lng + end.lng) / 2 + 0.003 }
            ],
            distance: calculateDistance(start, end) * 1.05,
            estimatedTime: Math.round(calculateDistance(start, end) * 1.05 / 20 / 1.852),
            riskLevel: 'high',
            riskDescription: '借助洋流可快速到达，但海况复杂'
          }
        ];

        set({ routeOptions });
      },

      resetTraining: () => set({
        currentRecordId: null,
        scenario: null,
        lighthouses: LIGHTHOUSES,
        bearings: {},
        positionMark: null,
        selectedRoute: null,
        routeOptions: [],
        estimatedPosition: null,
        triangleData: null,
        decisionReason: '',
        isSubmitted: false,
        operations: [],
        startTime: null
      }),

      markAsSubmitted: () => {
        set({ isSubmitted: true });
        get().addOperation(OperationType.SUBMIT, '提交训练记录，等待复核');
      },

      addOperation: (actionType, detail, details = {}, hasUnitError = false) => {
        const now = new Date();
        const newOperation: OperationLog = {
          id: generateId(),
          recordId: get().currentRecordId || 'temp',
          actionType,
          actionDetail: detail,
          timestamp: now,
          operator: get().traineeName
        };

        (newOperation as any).type = actionType;
        (newOperation as any).description = detail;
        (newOperation as any).details = details;
        (newOperation as any).hasUnitError = hasUnitError;

        set({
          operations: [...get().operations, newOperation]
        });
      },

      toTrainingRecord: () => {
        const state = get();
        return {
          id: state.currentRecordId || generateId(),
          scenarioId: state.scenario?.id || '',
          startTime: state.startTime || new Date(),
          endTime: new Date(),
          bearings: state.bearings,
          positionMark: state.positionMark,
          selectedRoute: state.selectedRoute,
          triangleData: state.triangleData,
          estimatedPosition: state.estimatedPosition,
          operations: state.operations
        };
      }
    }),
    {
      name: 'triangulation-training-storage',
      partialize: (state) => ({
        currentRecordId: state.currentRecordId,
        traineeName: state.traineeName,
        scenario: state.scenario,
        bearings: state.bearings,
        positionMark: state.positionMark,
        selectedRoute: state.selectedRoute,
        triangleData: state.triangleData,
        estimatedPosition: state.estimatedPosition,
        decisionReason: state.decisionReason,
        isSubmitted: state.isSubmitted,
        operations: state.operations,
        startTime: state.startTime
      })
    }
  )
);
