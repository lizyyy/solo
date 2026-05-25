import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HistoryRecord, PlacedItem, BoxType } from '../types/game';
import { getBoxTypeById } from '../data/boxTypes';
import { getLevelById } from '../data/levels';
import { render } from '../utils/canvas/renderer';
import { getCommodityById } from '../data/commodities';

interface ReplayPlayerProps {
  record: HistoryRecord;
  onClose: () => void;
}

export const ReplayPlayer = ({ record, onClose }: ReplayPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  const level = useMemo(() => getLevelById(record.levelId), [record.levelId]);
  const boxType = useMemo(() => level ? getBoxTypeById(level.boxTypeId) : null, [level]);
  
  const placeOperations = useMemo(() => {
    return record.operationStack.filter(op => op.type === 'place');
  }, [record.operationStack]);
  
  const currentPlacedItems = useMemo(() => {
    const items: PlacedItem[] = [];
    for (let i = 0; i < currentStep; i++) {
      if (placeOperations[i]) {
        items.push(placeOperations[i].item);
      }
    }
    return items;
  }, [currentStep, placeOperations]);
  
  const currentPendingCount = useMemo(() => {
    return record.totalCommodities - currentPlacedItems.length;
  }, [record.totalCommodities, currentPlacedItems.length]);
  
  const draw = useCallback(() => {
    if (!canvasRef.current || !boxType) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    render(
      ctx,
      rect.width,
      rect.height,
      boxType,
      currentPlacedItems,
      {
        showGrid: true,
        showLabels: true,
        highlightViolations: false,
        violationCommodityIds: [],
        previewItem: undefined,
      }
    );
  }, [boxType, currentPlacedItems]);
  
  useEffect(() => {
    draw();
  }, [draw]);
  
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);
  
  useEffect(() => {
    if (!isPlaying || currentStep >= placeOperations.length) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }
    
    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      
      const delta = timestamp - lastTimeRef.current;
      const stepInterval = 1000 / playSpeed;
      
      if (delta >= stepInterval) {
        setCurrentStep(prev => {
          const next = prev + 1;
          if (next >= placeOperations.length) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
        lastTimeRef.current = timestamp;
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentStep, placeOperations.length, playSpeed]);
  
  const handlePlayPause = () => {
    if (currentStep >= placeOperations.length) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
    lastTimeRef.current = 0;
  };
  
  const handleStepBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
    setIsPlaying(false);
  };
  
  const handleStepForward = () => {
    setCurrentStep(prev => Math.min(placeOperations.length, prev + 1));
    setIsPlaying(false);
  };
  
  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };
  
  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(playSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaySpeed(speeds[nextIndex]);
  };
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentStep(parseInt(e.target.value, 10));
    setIsPlaying(false);
  };
  
  const getCurrentCommodityName = () => {
    if (currentStep === 0) return '准备开始';
    const op = placeOperations[currentStep - 1];
    if (!op) return '';
    const commodity = getCommodityById(op.item.commodityId);
    return commodity ? commodity.name : '';
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div>
            <h3 className="text-lg font-bold">历史回放 - {record.levelName}</h3>
            <p className="text-sm opacity-90">
              用时: {formatTime(record.timeUsed)} | 得分: {record.score} | 等级: {record.grade}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 bg-gray-50 overflow-hidden">
          <div className="lg:flex-1 bg-white rounded-xl shadow-inner overflow-hidden" style={{ minHeight: '400px' }}>
            {boxType ? (
              <canvas
                ref={canvasRef}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                无法加载箱型信息
              </div>
            )}
          </div>
          
          <div className="lg:w-72 space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <h4 className="font-semibold text-gray-700 mb-3">回放进度</h4>
              <div className="text-center mb-3">
                <span className="text-3xl font-bold text-blue-600">{currentStep}</span>
                <span className="text-gray-400 mx-2">/</span>
                <span className="text-xl text-gray-500">{placeOperations.length}</span>
                <div className="text-sm text-gray-500 mt-1">
                  剩余: {currentPendingCount} 件商品
                </div>
              </div>
              
              <input
                type="range"
                min="0"
                max={placeOperations.length}
                value={currentStep}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={handleReset}
                  className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  title="重置"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={handleStepBack}
                  className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  title="上一步"
                  disabled={currentStep === 0}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                  title={isPlaying ? '暂停' : '播放'}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>
                <button
                  onClick={handleStepForward}
                  className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  title="下一步"
                  disabled={currentStep >= placeOperations.length}
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  onClick={handleSpeedChange}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium min-w-[60px]"
                  title="播放速度"
                >
                  {playSpeed}x
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow">
              <h4 className="font-semibold text-gray-700 mb-3">当前步骤</h4>
              <div className="text-center py-4">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-white text-lg font-bold mb-2 ${
                  currentStep === 0 ? 'bg-gray-400' : 'bg-green-500'
                }`}>
                  {currentStep === 0 ? '?' : currentStep}
                </div>
                <div className="font-medium text-gray-800">
                  {currentStep === 0 ? '点击播放开始回放' : `放置: ${getCurrentCommodityName()}`}
                </div>
                {currentStep > 0 && placeOperations[currentStep - 1] && (
                  <div className="text-sm text-gray-500 mt-1">
                    位置: ({placeOperations[currentStep - 1].item.x}, {placeOperations[currentStep - 1].item.y})
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-semibold text-blue-700 mb-2">操作说明</h4>
              <ul className="text-sm text-blue-600 space-y-1">
                <li>• 点击播放按钮开始自动回放</li>
                <li>• 使用步进按钮逐帧查看</li>
                <li>• 拖动滑块快速跳转</li>
                <li>• 点击速度按钮调整播放速度</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
