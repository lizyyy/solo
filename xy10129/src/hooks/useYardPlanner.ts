import { useState, useCallback, useMemo } from 'react';
import { YardConfig, PathWaypoint, PathPlan, ValidationResult, SavedPlan, ToolMode } from '../types';
import { defaultYardConfig } from '../data/defaultYard';
import { buildPathPlan, validatePath } from '../utils/pathValidator';
import { savePlan, getAllPlans, deletePlan } from '../utils/storage';
import { generateReportData, downloadReport } from '../utils/reportGenerator';
import { generateId } from '../utils/geometry';
import * as THREE from 'three';

export const useYardPlanner = () => {
  const [yardConfig, setYardConfig] = useState<YardConfig>(defaultYardConfig);
  const [waypoints, setWaypoints] = useState<PathWaypoint[]>([]);
  const [pathPlan, setPathPlan] = useState<PathPlan | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(getAllPlans());
  const [toolMode, setToolMode] = useState<ToolMode>('view');
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');

  const addWaypoint = useCallback((position: THREE.Vector3) => {
    if (toolMode !== 'draw') return;

    const type: PathWaypoint['type'] = waypoints.length === 0 ? 'start' : 
                                   waypoints.length === 1 ? 'end' : 'waypoint';

    const newWaypoint: PathWaypoint = {
      id: generateId(),
      position: {
        x: Number(position.x.toFixed(2)),
        y: 0,
        z: Number(position.z.toFixed(2))
      },
      type,
      timestamp: Date.now()
    };

    const newWaypoints = [...waypoints, newWaypoint];
    setWaypoints(newWaypoints);

    if (newWaypoints.length >= 2) {
      const plan = buildPathPlan(newWaypoints, planName || '未命名方案');
      setPathPlan(plan);
      const val = validatePath(plan, yardConfig);
      setValidation(val);
    }
  }, [toolMode, waypoints, planName, yardConfig]);

  const updateWaypoint = useCallback((id: string, position: { x: number; y: number; z: number }) => {
    setWaypoints(prev => {
      const updated = prev.map(wp => 
        wp.id === id 
          ? { ...wp, position: { x: Number(position.x.toFixed(2)), y: 0, z: Number(position.z.toFixed(2)) } }
          : wp
      );
      
      if (updated.length >= 2) {
        const plan = buildPathPlan(updated, planName || '未命名方案');
        setPathPlan(plan);
        const val = validatePath(plan, yardConfig);
        setValidation(val);
      }
      
      return updated;
    });
  }, [planName, yardConfig]);

  const deleteWaypoint = useCallback((id: string) => {
    setWaypoints(prev => {
      const updated = prev.filter(wp => wp.id !== id).map((wp, idx, arr) => {
        if (idx === 0) return { ...wp, type: 'start' as const };
        if (idx === arr.length - 1) return { ...wp, type: 'end' as const };
        return { ...wp, type: 'waypoint' as const };
      });

      if (updated.length >= 2) {
        const plan = buildPathPlan(updated, planName || '未命名方案');
        setPathPlan(plan);
        const val = validatePath(plan, yardConfig);
        setValidation(val);
      } else {
        setPathPlan(null);
        setValidation(null);
      }

      return updated;
    });
  }, [planName, yardConfig]);

  const clearPath = useCallback(() => {
    setWaypoints([]);
    setPathPlan(null);
    setValidation(null);
    setSelectedWaypoint(null);
  }, []);

  const refreshSavedPlans = useCallback(() => {
    setSavedPlans(getAllPlans());
  }, []);

  const saveCurrentPlan = useCallback(() => {
    if (!pathPlan) return;
    
    let finalName = planName || '未命名方案';
    const saved = savePlan(finalName, yardConfig, pathPlan, validation || {
      isValid: true,
      errors: [],
      warnings: []
    });
    
    refreshSavedPlans();
    return saved;
  }, [pathPlan, planName, yardConfig, validation, refreshSavedPlans]);

  const loadPlan = useCallback((plan: SavedPlan) => {
    setYardConfig(plan.yardConfig);
    setWaypoints(plan.pathPlan.waypoints);
    setPathPlan(plan.pathPlan);
    setValidation(plan.validation);
    setPlanName(plan.name);
  }, []);

  const removePlan = useCallback((id: string) => {
    deletePlan(id);
    refreshSavedPlans();
  }, [refreshSavedPlans]);

  const exportReport = useCallback(() => {
    if (!pathPlan) return;
    
    const reportData = generateReportData(
      planName || '未命名方案',
      pathPlan,
      yardConfig,
      validation || {
        isValid: true,
        errors: [],
        warnings: []
      }
    );
    
    downloadReport(reportData);
  }, [pathPlan, planName, yardConfig, validation]);

  const stats = useMemo(() => {
    if (!pathPlan) return null;
    
    return {
      totalDistance: pathPlan.totalDistance,
      waypointCount: pathPlan.waypoints.length,
      segmentCount: pathPlan.segments.length,
      errorCount: validation?.errors.filter(e => e.severity === 'error').length || 0,
      warningCount: validation?.warnings.length || 0
    };
  }, [pathPlan, validation]);

  return {
    yardConfig,
    waypoints,
    pathPlan,
    validation,
    savedPlans,
    toolMode,
    selectedWaypoint,
    planName,
    stats,
    setToolMode,
    setSelectedWaypoint,
    setPlanName,
    setYardConfig,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    clearPath,
    saveCurrentPlan,
    loadPlan,
    removePlan,
    exportReport,
    refreshSavedPlans
  };
};
