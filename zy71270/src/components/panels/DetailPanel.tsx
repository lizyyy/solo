import { useState, useMemo, useCallback } from 'react';
import {
  Info,
  GitCompare,
  History,
  Edit3,
  X,
  Plus,
  Check,
  Route,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDataStore, useViewStore, useModificationStore } from '../../store';
import type { Shelf, Robot, ChargingStation, PathSegment } from '../../types';
import Badge from '../common/Badge';
import GlassPanel from '../common/GlassPanel';
import ModificationModal from './ModificationModal';
import dayjs from 'dayjs';

type DetailTab = 'detail' | 'compare' | 'history';

interface FieldRow {
  label: string;
  value: string | number;
  fieldName: string;
}

type CompareElement = {
  id: string;
  type: 'shelf' | 'robot' | 'station' | 'path';
  name: string;
};

export default function DetailPanel() {
  const [activeTab, setActiveTab] = useState<DetailTab>('detail');
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [compareList, setCompareList] = useState<CompareElement[]>([]);

  const selectedElementId = useViewStore((s) => s.selectedElementId);
  const selectedElementType = useViewStore((s) => s.selectedElementType);
  const clearSelection = useViewStore((s) => s.clearSelection);

  const getShelfById = useDataStore((s) => s.getShelfById);
  const getRobotById = useDataStore((s) => s.getRobotById);
  const getStationById = useDataStore((s) => s.getStationById);
  const getPathSegmentById = useDataStore((s) => s.getPathSegmentById);

  const getModificationsByEntity = useModificationStore(
    (s) => s.getModificationsByEntity
  );

  const tabs: Array<{ key: DetailTab; label: string; icon: React.ElementType }> = [
    { key: 'detail', label: '详情', icon: Info },
    { key: 'compare', label: '对比', icon: GitCompare },
    { key: 'history', label: '历史', icon: History },
  ];

  const entity = useMemo(() => {
    if (!selectedElementId || !selectedElementType) return null;
    switch (selectedElementType) {
      case 'shelf':
        return getShelfById(selectedElementId) ?? null;
      case 'robot':
        return getRobotById(selectedElementId) ?? null;
      case 'station':
        return getStationById(selectedElementId) ?? null;
      case 'path':
        return getPathSegmentById(selectedElementId) ?? null;
      default:
        return null;
    }
  }, [selectedElementId, selectedElementType, getShelfById, getRobotById, getStationById, getPathSegmentById]);

  const modifications = useMemo(() => {
    if (!selectedElementId || !selectedElementType) return [];
    if (selectedElementType === 'path') return [];
    const entityType = selectedElementType === 'station' ? 'charging' : selectedElementType;
    return getModificationsByEntity(entityType as 'shelf' | 'trajectory' | 'congestion' | 'charging', selectedElementId);
  }, [selectedElementId, selectedElementType, getModificationsByEntity]);

  const isInCompareList = useMemo(() => {
    if (!selectedElementId || !selectedElementType) return false;
    return compareList.some((c) => c.id === selectedElementId);
  }, [selectedElementId, selectedElementType, compareList]);

  const toggleCompare = useCallback(() => {
    if (!selectedElementId || !selectedElementType) return;
    if (isInCompareList) {
      setCompareList((prev) => prev.filter((c) => c.id !== selectedElementId));
    } else if (compareList.length < 2) {
      let name = selectedElementId;
      if (selectedElementType === 'shelf') {
        const shelf = getShelfById(selectedElementId);
        name = shelf ? `货架 ${shelf.id.slice(-4)}` : name;
      } else if (selectedElementType === 'robot') {
        const robot = getRobotById(selectedElementId);
        name = robot?.name ?? name;
      } else if (selectedElementType === 'station') {
        const station = getStationById(selectedElementId);
        name = station ? `充电站 ${station.id.slice(-4)}` : name;
      } else if (selectedElementType === 'path') {
        const segment = getPathSegmentById(selectedElementId);
        name = segment ? `路径 ${segment.id.slice(-6)}` : name;
      }
      setCompareList((prev) => [
        ...prev,
        { id: selectedElementId, type: selectedElementType as 'shelf' | 'robot' | 'station' | 'path', name },
      ]);
    }
  }, [selectedElementId, selectedElementType, compareList.length, isInCompareList, getShelfById, getRobotById, getStationById, getPathSegmentById]);

  const getEntityForCompare = useCallback(
    (item: CompareElement) => {
      if (item.type === 'shelf') return getShelfById(item.id);
      if (item.type === 'robot') return getRobotById(item.id);
      if (item.type === 'station') return getStationById(item.id);
      if (item.type === 'path') return getPathSegmentById(item.id);
      return null;
    },
    [getShelfById, getRobotById, getStationById, getPathSegmentById]
  );

  const fields: FieldRow[] = useMemo(() => {
    if (!entity) return [];
    if ('capacity' in entity) {
      const shelf = entity as Shelf;
      return [
        { label: 'ID', value: shelf.id, fieldName: 'id' },
        { label: '区域', value: shelf.zone, fieldName: 'zone' },
        { label: '容量', value: shelf.capacity, fieldName: 'capacity' },
        { label: '库存', value: shelf.currentStock, fieldName: 'currentStock' },
        { label: 'SKU数', value: shelf.skuList.length, fieldName: 'skuList' },
        {
          label: '拥堵等级',
          value: shelf.congestionLevel?.toFixed(2) ?? '--',
          fieldName: 'congestionLevel',
        },
        { label: '数据缺失', value: shelf.isMissingData ? '是' : '否', fieldName: 'isMissingData' },
      ];
    }
    if ('batteryLevel' in entity) {
      const robot = entity as Robot;
      return [
        { label: 'ID', value: robot.id, fieldName: 'id' },
        { label: '名称', value: robot.name, fieldName: 'name' },
        { label: '型号', value: robot.model, fieldName: 'model' },
        { label: '状态', value: robot.status, fieldName: 'status' },
        { label: '电量', value: `${robot.batteryLevel}%`, fieldName: 'batteryLevel' },
        { label: '楼层', value: robot.currentFloor ?? '--', fieldName: 'currentFloor' },
      ];
    }
    if ('power' in entity) {
      const station = entity as ChargingStation;
      return [
        { label: 'ID', value: station.id, fieldName: 'id' },
        { label: '状态', value: station.status, fieldName: 'status' },
        { label: '功率', value: `${station.power}kW`, fieldName: 'power' },
        { label: '排队数', value: station.queue.length, fieldName: 'queue' },
      ];
    }
    if ('density' in entity && 'startPoint' in entity) {
      const segment = entity as PathSegment;
      return [
        { label: '路径ID', value: segment.id, fieldName: 'id' },
        { label: '机器人ID', value: segment.robotId, fieldName: 'robotId' },
        { label: '路径密度', value: segment.density, fieldName: 'density' },
        { label: '平均速度', value: `${segment.avgSpeed.toFixed(2)} m/s`, fieldName: 'avgSpeed' },
        { label: '是否断点', value: segment.isBroken ? '是' : '否', fieldName: 'isBroken' },
        { label: '起点楼层', value: segment.startPoint.floor, fieldName: 'startFloor' },
        { label: '终点楼层', value: segment.endPoint.floor, fieldName: 'endFloor' },
        { label: '起点X', value: segment.startPoint.position.x.toFixed(2), fieldName: 'startX' },
        { label: '起点Y', value: segment.startPoint.position.y.toFixed(2), fieldName: 'startY' },
        { label: '终点X', value: segment.endPoint.position.x.toFixed(2), fieldName: 'endX' },
        { label: '终点Y', value: segment.endPoint.position.y.toFixed(2), fieldName: 'endY' },
      ];
    }
    return [];
  }, [entity]);

  if (!entity) {
    return (
      <GlassPanel title="详情面板" className="w-72">
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Info className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-sm">点击场景中的元素查看详情</span>
        </div>
      </GlassPanel>
    );
  }

  return (
    <>
      <GlassPanel
        title="详情面板"
        className="w-72"
        actions={
          <button
            onClick={clearSelection}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        }
      >
      <div className="space-y-3">
        <div className="flex gap-1 border-b border-warehouse-border/30 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'tab-btn flex items-center gap-1',
                activeTab === tab.key && 'active'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'detail' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-1">
                {selectedElementType === 'shelf'
                  ? '货架'
                  : selectedElementType === 'robot'
                    ? '机器人'
                    : selectedElementType === 'station'
                      ? '充电站'
                      : <><Route className="w-4 h-4" />路径段</>}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={toggleCompare}
                  disabled={!isInCompareList && compareList.length >= 2}
                  className={cn(
                    'btn text-xs py-1 px-2 gap-1',
                    isInCompareList
                      ? 'btn-primary'
                      : 'btn-secondary',
                    !isInCompareList && compareList.length >= 2 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isInCompareList ? (
                    <><Check className="w-3 h-3" />已添加</>
                  ) : (
                    <><Plus className="w-3 h-3" />对比</>
                  )}
                </button>
                {selectedElementType !== 'path' && (
                  <button
                    onClick={() => setShowModifyModal(true)}
                    className="btn btn-secondary text-xs py-1 px-2 gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    修正
                  </button>
                )}
              </div>
            </div>
            <table className="data-table">
              <tbody>
                {fields.map((field) => (
                  <tr key={field.fieldName}>
                    <td className="text-slate-400 text-xs w-20">
                      {field.label}
                    </td>
                    <td className="text-slate-200 text-xs font-mono">
                      {field.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 mb-2">
              已选择 {compareList.length}/2 个元素进行对比
            </div>
            {compareList.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-4">
                点击详情页的「对比」按钮添加元素
              </div>
            ) : (
              <div className="space-y-2">
                {compareList.map((item, idx) => (
                  <div key={item.id} className="card p-2 flex items-center justify-between">
                    <div>
                      <Badge variant={idx === 0 ? 'info' : 'warning'}>元素{idx + 1}</Badge>
                      <span className="ml-2 text-sm text-slate-200">{item.name}</span>
                    </div>
                    <button
                      onClick={() => setCompareList((prev) => prev.filter((c) => c.id !== item.id))}
                      className="text-slate-500 hover:text-status-red transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {compareList.length === 2 && compareList[0].type === compareList[1].type && (
                  <div className="mt-4 border-t border-warehouse-border/30 pt-4">
                    <div className="text-xs text-slate-400 mb-3">属性对比</div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="text-slate-500">属性</th>
                          <th>元素1</th>
                          <th>元素2</th>
                          <th>差异</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const e1 = getEntityForCompare(compareList[0]);
                          const e2 = getEntityForCompare(compareList[1]);
                          if (!e1 || !e2) return null;
                          const getFieldValue = (
                            obj: unknown,
                            field: string
                          ): string => {
                            const val = (obj as Record<string, unknown>)[field];
                            if (val === undefined || val === null) return '--';
                            if (Array.isArray(val)) return String(val.length);
                            return String(val);
                          };
                          let fieldsToCompare: Array<{ label: string; field: string }>;
                          if (compareList[0].type === 'shelf') {
                            fieldsToCompare = [
                              { label: '容量', field: 'capacity' },
                              { label: '库存', field: 'currentStock' },
                              { label: '区域', field: 'zone' },
                              { label: '拥堵等级', field: 'congestionLevel' },
                            ];
                          } else if (compareList[0].type === 'robot') {
                            fieldsToCompare = [
                              { label: '名称', field: 'name' },
                              { label: '型号', field: 'model' },
                              { label: '状态', field: 'status' },
                              { label: '电量', field: 'batteryLevel' },
                            ];
                          } else if (compareList[0].type === 'station') {
                            fieldsToCompare = [
                              { label: '状态', field: 'status' },
                              { label: '功率', field: 'power' },
                              { label: '排队数', field: 'queue' },
                            ];
                          } else {
                            fieldsToCompare = [
                              { label: '路径密度', field: 'density' },
                              { label: '平均速度', field: 'avgSpeed' },
                              { label: '是否断点', field: 'isBroken' },
                            ];
                          }
                          return fieldsToCompare.map((f) => {
                            const v1 = getFieldValue(e1, f.field);
                            const v2 = getFieldValue(e2, f.field);
                            const isDifferent = v1 !== v2;
                            return (
                              <tr key={f.field}>
                                <td className="text-slate-400 text-xs">{f.label}</td>
                                <td className="font-mono text-xs">{v1}</td>
                                <td className="font-mono text-xs">{v2}</td>
                                <td>
                                  {isDifferent ? (
                                    <Badge variant="warning">不同</Badge>
                                  ) : (
                                    <Badge variant="success">相同</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                    <button
                      onClick={() => setCompareList([])}
                      className="btn btn-secondary w-full mt-4 text-xs"
                    >
                      清空对比
                    </button>
                  </div>
                )}
                {compareList.length === 2 && compareList[0].type !== compareList[1].type && (
                  <div className="text-center text-sm text-status-amber py-2">
                    类型不同的元素无法对比
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {modifications.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-4">
                暂无修改记录
              </div>
            ) : (
              modifications.map((mod) => (
                <div
                  key={mod.id}
                  className="card p-2 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={mod.isRollback ? 'warning' : 'info'}>
                      {mod.isRollback ? '回滚' : '修改'}
                    </Badge>
                    <span className="text-slate-500 font-mono">
                      {dayjs(mod.modifiedAt).format('MM/DD HH:mm')}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    字段: <span className="text-slate-200">{mod.fieldName}</span>
                  </div>
                  <div className="text-slate-400">
                    <span className="text-status-red line-through">{mod.oldValue}</span>
                    {' → '}
                    <span className="text-status-green">{mod.newValue}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </GlassPanel>
      <ModificationModal
        isOpen={showModifyModal}
        onClose={() => setShowModifyModal(false)}
      />
    </>
  );
}
