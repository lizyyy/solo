import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Undo2, Redo2, Send, Info, Layers } from 'lucide-react';
import { useGameEngine } from '../hooks/useGameEngine';
import { GameCanvas } from '../components/GameCanvas';
import { CommodityCard } from '../components/CommodityCard';
import { Timer } from '../components/Timer';
import { ScorePanel } from '../components/ScorePanel';
import { Toast } from '../components/Toast';
import { SettlementPanel } from '../components/SettlementPanel';
import { getNextLevel } from '../data/levels';
import { useHistoryStore } from '../store/historyStore';
import { calculateSpaceUtilization, calculateTotalWeight } from '../utils/rules/rulesEngine';
import type { CommodityInstance } from '../types/game';

export const GameBoard = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const { addRecord, records, exportReport } = useHistoryStore();
  
  const {
    status,
    currentLevel,
    currentLevelId,
    placedItems,
    pendingCommodities,
    selectedCommodity,
    selectedBoxType,
    violations,
    settlementResult,
    timeElapsed,
    score,
    isPaused,
    toasts,
    startLevel,
    selectCommodity,
    placeItem,
    removeItem,
    undo,
    redo,
    pause,
    resume,
    restart,
    submit,
    reset,
    canUndo,
    canRedo,
    canSubmit,
    validatePlacement,
    removeToast,
    addToast,
  } = useGameEngine();
  
  useEffect(() => {
    if (levelId) {
      startLevel(levelId);
    }
    
    return () => {
      reset();
    };
  }, [levelId, startLevel, reset]);
  
  const spaceUtilization = useMemo(() => {
    if (!selectedBoxType) return 0;
    return calculateSpaceUtilization(placedItems, selectedBoxType);
  }, [placedItems, selectedBoxType]);
  
  const totalWeight = useMemo(() => {
    return calculateTotalWeight(placedItems);
  }, [placedItems]);
  
  const violationCommodityIds = useMemo(() => {
    return violations
      .map(v => v.commodityId)
      .filter(id => id);
  }, [violations]);
  
  const hasNextLevel = currentLevelId ? !!getNextLevel(currentLevelId) : false;
  
  const handleNextLevel = () => {
    if (currentLevelId) {
      const nextLevel = getNextLevel(currentLevelId);
      if (nextLevel) {
        navigate(`/game/${nextLevel.id}`);
      }
    }
  };
  
  const handleBackToMenu = () => {
    navigate('/');
  };
  
  const handleExportJSON = () => {
    const latestRecord = records[0];
    if (latestRecord) {
      exportReport(latestRecord.id, 'json');
    }
  };
  
  const handleExportText = () => {
    const latestRecord = records[0];
    if (latestRecord) {
      exportReport(latestRecord.id, 'text');
    }
  };
  
  const handleViewHistory = () => {
    navigate('/history');
  };
  
  if (!currentLevel || !selectedBoxType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Toast toasts={toasts} onRemove={removeToast} />
      
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToMenu}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={20} />
                <span>返回菜单</span>
              </button>
              
              <div className="h-6 w-px bg-gray-300" />
              
              <div>
                <h1 className="text-lg font-bold text-gray-800">{currentLevel.name}</h1>
                <p className="text-xs text-gray-500">{currentLevel.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Timer timeElapsed={timeElapsed} timeLimit={currentLevel.timeLimit} />
              
              <div className="flex items-center gap-2">
                <button
                  onClick={isPaused ? resume : pause}
                  className={`p-2 rounded-lg transition-colors ${isPaused ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title={isPaused ? '继续' : '暂停'}
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
                
                <button
                  onClick={restart}
                  className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                  title="重新开始"
                >
                  <RotateCcw size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {currentLevel.specialRule && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-2 text-orange-700 text-sm">
              <Info size={16} />
              <span className="font-medium">特殊规则：</span>
              <span>{currentLevel.specialRule}</span>
            </div>
          </div>
        </div>
      )}
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Layers size={18} className="text-blue-500" />
                箱型信息
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">名称</span>
                  <span className="font-medium">{selectedBoxType.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">内部尺寸</span>
                  <span className="font-medium">{selectedBoxType.width}×{selectedBoxType.height} 格</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">最大承重</span>
                  <span className="font-medium">{selectedBoxType.maxWeight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">格大小</span>
                  <span className="font-medium">{selectedBoxType.gridSize} px</span>
                </div>
              </div>
            </div>
            
            <ScorePanel
              score={score}
              violations={violations}
              spaceUtilization={spaceUtilization}
              totalWeight={totalWeight}
              maxWeight={selectedBoxType.maxWeight}
            />
          </div>
          
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-4 h-[500px]">
              <GameCanvas
                boxType={selectedBoxType}
                placedItems={placedItems}
                selectedCommodity={selectedCommodity as CommodityInstance | null}
                violationCommodityIds={violationCommodityIds}
                onPlace={placeItem}
                onRemove={removeItem}
                validatePlacement={validatePlacement}
                isPlaying={status === 'playing'}
                isPaused={isPaused}
              />
            </div>
            
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Undo2 size={18} />
                撤销
              </button>
              
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Redo2 size={18} />
                重做
              </button>
              
              <button
                onClick={submit}
                disabled={!canSubmit()}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all
                  ${canSubmit()
                    ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <Send size={18} />
                提交装箱
              </button>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">
                  {pendingCommodities.length}
                </span>
                待装商品
              </h3>
              
              {pendingCommodities.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>所有商品已装箱</p>
                  <p className="text-sm mt-1">点击"提交装箱"完成</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {pendingCommodities.map((commodity) => (
                    <CommodityCard
                      key={commodity.instanceId}
                      commodity={commodity}
                      isSelected={selectedCommodity?.instanceId === commodity.instanceId}
                      onClick={() => selectCommodity(selectedCommodity?.instanceId === commodity.instanceId ? null : commodity)}
                    />
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-700 mb-2 text-sm">操作提示</h4>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• 点击商品选中，拖拽到箱内放置</li>
                <li>• 拖拽中滚轮调整层级，R键旋转</li>
                <li>• 右键点击箱内商品可移除</li>
                <li>• 所有商品装箱后才可提交</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      {(status === 'submitted' || status === 'failed') && settlementResult && (
        <SettlementPanel
          result={settlementResult}
          levelName={currentLevel.name}
          timeUsed={timeElapsed}
          hasNextLevel={hasNextLevel}
          onRestart={restart}
          onNextLevel={handleNextLevel}
          onBackToMenu={handleBackToMenu}
          onViewHistory={handleViewHistory}
          onExportJSON={handleExportJSON}
          onExportText={handleExportText}
        />
      )}
    </div>
  );
};
