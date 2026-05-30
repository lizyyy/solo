import { create } from 'zustand';
import {
  Level,
  PlacedPolygon,
  ValidationResult,
  SimulationResult,
  GameRecord,
  ReportData
} from '../types';
import { baseBlocks } from '../data/levels';
import { validateBridge, calculateUsedArea, getSuggestions } from '../engine/validator';
import { simulateBridge, calculateEfficiency } from '../engine/physics';
import { createPlacedPolygon, updatePlacedPolygon } from '../engine/geometry';
interface GameState {
 currentLevel: Level | null;
 placedPolygons: PlacedPolygon[];
 selectedInstanceId: string | null;
 isSimulating: boolean;
 validationResult: ValidationResult | null;
 simulationResult: SimulationResult | null;
 showReport: boolean;
 gameRecords: GameRecord[];
 replayFrameIndex: number;
 isPlaying: boolean;
 currentView: 'menu' | 'game' | 'report';
 setCurrentLevel: (level: Level) => void;
 addPolygon: (blockId: string, position: {
 x: number;
 y: number;
 }, rotation?: number) => void;
 updatePolygon: (instanceId: string, position: {
 x: number;
 y: number;
 }, rotation: number) => void;
 removePolygon: (instanceId: string) => void;
 selectPolygon: (instanceId: string | null) => void;
 clearBridge: () => void;
 validate: () => void;
 startSimulation: () => void;
 setShowReport: (show: boolean) => void;
 generateReport: () => ReportData | null;
 saveRecord: () => void;
 exportRecord: () => string;
 loadSampleData: (sampleKey: string) => void;
 setReplayFrameIndex: (index: number) => void;
 setIsPlaying: (playing: boolean) => void;
 setCurrentView: (view: 'menu' | 'game' | 'report') => void;
 resetGame: () => void;
}
export const useGameStore = create<GameState>((set, get) => ({
 currentLevel: null,
 placedPolygons: [],
 selectedInstanceId: null,
 isSimulating: false,
 validationResult: null,
 simulationResult: null,
 showReport: false,
 gameRecords: [],
 replayFrameIndex: 0,
 isPlaying: false,
 currentView: 'menu',
 setCurrentLevel: (level) => {
 set({
 currentLevel: level,
 placedPolygons: [],
 selectedInstanceId: null,
 validationResult: null,
 simulationResult: null,
 showReport: false,
 replayFrameIndex: 0,
 isPlaying: false,
 currentView: 'game'
 });
 },
 addPolygon: (blockId, position, rotation = 0) => {
 const { currentLevel } = get();
 if (!currentLevel)
 return;
 const block = currentLevel.availableBlocks.find(b => b.id === blockId) ||
 baseBlocks.find(b => b.id === blockId);
 if (!block)
 return;
 const newPolygon = createPlacedPolygon(block, position, rotation);
 set(state => ({
 placedPolygons: [...state.placedPolygons, newPolygon],
 validationResult: null
 }));
 },
 updatePolygon: (instanceId, position, rotation) => {
 const { currentLevel, placedPolygons } = get();
 if (!currentLevel)
 return;
 const polygon = placedPolygons.find(p => p.instanceId === instanceId);
 if (!polygon)
 return;
 const block = currentLevel.availableBlocks.find(b => b.id === polygon.blockId) ||
 baseBlocks.find(b => b.id === polygon.blockId);
 if (!block)
 return;
 const updated = updatePlacedPolygon(polygon, block, position, rotation);
 set(state => ({
 placedPolygons: state.placedPolygons.map(p => p.instanceId === instanceId ? updated : p),
 validationResult: null
 }));
 },
 removePolygon: (instanceId) => {
 set(state => ({
 placedPolygons: state.placedPolygons.filter(p => p.instanceId !== instanceId),
 selectedInstanceId: state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
 validationResult: null
 }));
 },
 selectPolygon: (instanceId) => {
 set({ selectedInstanceId: instanceId });
 },
 clearBridge: () => {
 set({
 placedPolygons: [],
 selectedInstanceId: null,
 validationResult: null,
 simulationResult: null,
 showReport: false,
 replayFrameIndex: 0,
 isPlaying: false
 });
 },
 validate: () => {
 const { currentLevel, placedPolygons } = get();
 if (!currentLevel)
 return;
 const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
 const result = validateBridge(placedPolygons, allBlocks, currentLevel);
 set({ validationResult: result });
 },
 startSimulation: () => {
 const { currentLevel, validate } = get();
 if (!currentLevel)
 return;
 validate();
 const { validationResult } = get();
 if (!validationResult?.valid)
 return;
 set({ isSimulating: true, simulationResult: null });
 setTimeout(() => {
 const { currentLevel, placedPolygons } = get();
 if (!currentLevel)
 return;
 const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
 const result = simulateBridge(placedPolygons, allBlocks, currentLevel.piers, currentLevel.truck, currentLevel.startPoint, currentLevel.endPoint);
 set({
 isSimulating: false,
 simulationResult: result,
 showReport: true,
 replayFrameIndex: 0,
 currentView: 'report'
 });
 }, 100);
 },
 setShowReport: (show) => {
 set({ showReport: show });
 },
 generateReport: () => {
 const { currentLevel, placedPolygons, validationResult, simulationResult } = get();
 if (!currentLevel || !validationResult)
 return null;
 const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
 const usedArea = calculateUsedArea(placedPolygons, allBlocks);
 const suggestions = getSuggestions(validationResult, usedArea, currentLevel.areaBudget);
 return {
 level: currentLevel,
 validationResult,
 simulationResult: simulationResult || {
 success: false,
 maxLoad: 0,
 maxStress: 0,
 stressMap: {},
 replayData: [],
 totalDistance: 0
 },
 usedArea,
 efficiency: simulationResult
 ? calculateEfficiency(usedArea, currentLevel.areaBudget, simulationResult.maxStress, simulationResult.success)
 : 0,
 suggestions
 };
 },
 saveRecord: () => {
 const { currentLevel, placedPolygons, simulationResult } = get();
 if (!currentLevel || !simulationResult)
 return;
 const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
 const usedArea = calculateUsedArea(placedPolygons, allBlocks);
 const record: GameRecord = {
 id: Date.now().toString(),
 levelId: currentLevel.id,
 levelName: currentLevel.name,
 timestamp: Date.now(),
 success: simulationResult.success,
 usedArea,
 areaBudget: currentLevel.areaBudget,
 maxStress: simulationResult.maxStress,
 failureReason: simulationResult.failureReason,
 placedPolygons: [...placedPolygons]
 };
 set(state => ({
 gameRecords: [...state.gameRecords, record]
 }));
 },
 exportRecord: () => {
 const { currentLevel, placedPolygons, simulationResult, validationResult } = get();
 if (!currentLevel || !simulationResult)
 return '';
 const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
 const usedArea = calculateUsedArea(placedPolygons, allBlocks);
 const exportData = {
 exportTime: new Date().toISOString(),
 level: {
 id: currentLevel.id,
 name: currentLevel.name,
 difficulty: currentLevel.difficulty
 },
 result: {
 success: simulationResult.success,
 usedArea,
 areaBudget: currentLevel.areaBudget,
 areaUsage: ((usedArea / currentLevel.areaBudget) * 100).toFixed(1) + '%',
 maxStress: simulationResult.maxStress.toFixed(3),
 failureReason: simulationResult.failureReason
 },
 validation: validationResult,
 bridge: placedPolygons.map(p => {
 const block = allBlocks.find(b => b.id === p.blockId);
 return {
 name: block?.name || p.blockId,
 position: p.position,
 rotation: p.rotation,
 area: block?.area || 0
 };
 }),
 replayData: simulationResult.replayData.map((f, i) => ({
 frame: i,
 time: f.time.toFixed(1) + '%',
 truckX: f.truckPosition.x.toFixed(0),
 stressed: f.polygonStates.filter(s => s.state === 'stressed').length,
 broken: f.polygonStates.filter(s => s.state === 'broken').length
 }))
 };
 return JSON.stringify(exportData, null, 2);
 },
 loadSampleData: (sampleKey) => {
 const { currentLevel } = get();
 if (!currentLevel)
 return;
 import('../data/levels').then(module => {
 const samples = module.sampleData;
 const sample = samples[sampleKey as keyof typeof samples];
 if (!sample || sample.levelId !== currentLevel.id)
 return;
 const newPolygons: PlacedPolygon[] = sample.placedPolygons.map((p, index) => {
 const block = currentLevel.availableBlocks.find(b => b.id === p.blockId) ||
 baseBlocks.find(b => b.id === p.blockId);
 if (!block)
 return null;
 const placed = createPlacedPolygon(block, p.position, p.rotation);
 placed.instanceId = `sample-${index}-${placed.instanceId}`;
 return placed;
 }).filter(Boolean) as PlacedPolygon[];
 set({
 placedPolygons: newPolygons,
 validationResult: null,
 simulationResult: null,
 showReport: false
 });
 });
 },
 setReplayFrameIndex: (index) => {
 set({ replayFrameIndex: index });
 },
 setIsPlaying: (playing) => {
 set({ isPlaying: playing });
 },
 setCurrentView: (view) => {
 set({ currentView: view });
 },
 resetGame: () => {
 set({
 currentLevel: null,
 placedPolygons: [],
 selectedInstanceId: null,
 isSimulating: false,
 validationResult: null,
 simulationResult: null,
 showReport: false,
 replayFrameIndex: 0,
 isPlaying: false,
 currentView: 'menu'
 });
 }
}));

