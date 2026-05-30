import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasRenderer } from '../../engine/renderer/canvas';
import { useEditorStore } from '../../store/useEditorStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { TrackElement, MagneticField } from '../../types';
import { createElementFromTool, getSourceToolName, traceElementSource } from '../../utils/traceability';
import { Trash2, RotateCw, Link2 } from 'lucide-react';

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    trackElements,
    magneticFields,
    selectedElementId,
    selectedFieldId,
    draggingTool,
    addTrackElement,
    addMagneticField,
    removeTrackElement,
    removeMagneticField,
    updateTrackElement,
    updateMagneticField,
    setSelectedElement,
    setSelectedField,
    setDraggingTool,
    snapToGrid,
    generateId,
    setHighlightedToolId,
    getElementAtPosition,
    getFieldAtPosition,
    dragOffset,
    setDragOffset,
  } = useEditorStore();

  const { currentTrajectory, currentFrame, showVectors, simulationResult } = useSimulationStore();

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showTraceInfo, setShowTraceInfo] = useState<{
    element: TrackElement | MagneticField;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    const renderer = rendererRef.current;
    if (!renderer) return;

    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      renderer.resize(Math.min(800, rect.width - 32), 600);
    }

    renderer.clear();
    renderer.drawGrid();

    magneticFields.forEach((field) => {
      renderer.drawMagneticField(field, field.id === selectedFieldId);
    });

    trackElements.forEach((el) => {
      renderer.drawTrackElement(el, el.id === selectedElementId);
    });

    if (currentTrajectory.length > 0) {
      const trajectoryToShow = currentTrajectory.slice(0, currentFrame + 1);
      renderer.drawTrajectory(trajectoryToShow, showVectors);

      if (simulationResult?.collisionPoint && currentFrame >= currentTrajectory.length - 1) {
        renderer.drawCollisionPoint(simulationResult.collisionPoint);
      }

      if (simulationResult?.success && currentFrame >= currentTrajectory.length - 1) {
        renderer.drawSuccessPoint(simulationResult.finalPosition);
      }
    }
  }, [trackElements, magneticFields, selectedElementId, selectedFieldId, currentTrajectory, currentFrame, showVectors, simulationResult]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          removeTrackElement(selectedElementId);
        } else if (selectedFieldId) {
          removeMagneticField(selectedFieldId);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedFieldId, removeTrackElement, removeMagneticField]);

  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

      const element = getElementAtPosition(x, y);
      const field = getFieldAtPosition(x, y);

      if (e.shiftKey) {
        if (element) {
          const trace = traceElementSource(element);
          if (trace.toolId) {
            setHighlightedToolId(trace.toolId);
            setShowTraceInfo({
              element,
              x: e.clientX,
              y: e.clientY,
            });
            setTimeout(() => setShowTraceInfo(null), 3000);
            setTimeout(() => setHighlightedToolId(null), 3000);
          }
          return;
        }
        if (field) {
          const trace = traceElementSource(field);
          if (trace.toolId) {
            setHighlightedToolId(trace.toolId);
            setShowTraceInfo({
              element: field,
              x: e.clientX,
              y: e.clientY,
            });
            setTimeout(() => setShowTraceInfo(null), 3000);
            setTimeout(() => setHighlightedToolId(null), 3000);
          }
          return;
        }
      }

      if (element) {
        setSelectedElement(element.id);
        setSelectedField(null);
      } else if (field) {
        setSelectedField(field.id);
        setSelectedElement(null);
      } else {
        setSelectedElement(null);
        setSelectedField(null);
      }
    },
    [getCanvasCoordinates, getElementAtPosition, getFieldAtPosition, setSelectedElement, setSelectedField, setHighlightedToolId]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
      setMousePos({ x: snapToGrid(x), y: snapToGrid(y) });

      if (draggingTool && canvasRef.current) {
        const renderer = rendererRef.current;
        if (!renderer) return;

        renderer.clear();
        renderer.drawGrid();

        magneticFields.forEach((field) => {
          renderer.drawMagneticField(field, field.id === selectedFieldId);
        });

        trackElements.forEach((el) => {
          renderer.drawTrackElement(el, el.id === selectedElementId);
        });

        const previewElement = createElementFromTool(
          draggingTool.id,
          mousePos.x - dragOffset.x,
          mousePos.y - dragOffset.y,
          generateId
        );

        if (previewElement && 'type' in previewElement) {
          renderer.drawTrackElement(previewElement, false, true);
        } else if (previewElement && 'direction' in previewElement) {
          renderer.drawMagneticField(previewElement, true);
        }
      }
    },
    [draggingTool, getCanvasCoordinates, mousePos, snapToGrid, magneticFields, trackElements, selectedFieldId, selectedElementId, dragOffset, generateId]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (draggingTool) {
        const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
        const finalX = snapToGrid(x - dragOffset.x);
        const finalY = snapToGrid(y - dragOffset.y);

        const newElement = createElementFromTool(draggingTool.id, finalX, finalY, generateId);

        if (newElement) {
          if ('type' in newElement) {
            addTrackElement(newElement as TrackElement);
          } else if ('direction' in newElement) {
            addMagneticField(newElement as MagneticField);
          }
        }

        setDraggingTool(null);
      }
    },
    [draggingTool, getCanvasCoordinates, snapToGrid, dragOffset, generateId, addTrackElement, addMagneticField, setDraggingTool]
  );

  const handleRotate = () => {
    if (selectedElementId) {
      const element = trackElements.find((el) => el.id === selectedElementId);
      if (element) {
        updateTrackElement(selectedElementId, {
          rotation: (element.rotation + 90) % 360,
        });
      }
    }
    if (selectedFieldId) {
      const field = magneticFields.find((f) => f.id === selectedFieldId);
      if (field) {
        const directions: Array<'into' | 'outof' | 'left' | 'right' | 'up' | 'down'> = [
          'into',
          'outof',
          'left',
          'right',
          'up',
          'down',
        ];
        const currentIndex = directions.indexOf(field.direction);
        const nextDirection = directions[(currentIndex + 1) % directions.length];
        updateMagneticField(selectedFieldId, { direction: nextDirection });
      }
    }
  };

  const handleDelete = () => {
    if (selectedElementId) {
      removeTrackElement(selectedElementId);
    } else if (selectedFieldId) {
      removeMagneticField(selectedFieldId);
    }
  };

  const selectedElement = trackElements.find((el) => el.id === selectedElementId);
  const selectedField = magneticFields.find((f) => f.id === selectedFieldId);

  return (
    <div ref={containerRef} className="flex-1 p-4 overflow-auto">
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="bg-space-deep rounded-xl border-2 border-tech-gray/30 cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        onMouseLeave={() => setDraggingTool(null)}
        />

        <AnimatePresence>
          {showTraceInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bg-space-dark border border-plasma-blue p-3 rounded-lg shadow-glow-blue z-10"
              style={{ left: showTraceInfo.x, top: showTraceInfo.y - 100 }}
            >
              <div className="flex items-center gap-2 text-plasma-blue mb-2">
                <Link2 className="w-4 h-4" />
                <span className="font-mono text-sm font-bold">溯源信息</span>
              </div>
              <div className="text-xs font-mono text-tech-light space-y-1">
                <p>来源工具: {getSourceToolName(showTraceInfo.element)}</p>
                <p>工具ID: <span className="text-plasma-blue">{showTraceInfo.element.sourceToolId}</span></p>
                <p>元素ID: <span className="text-tech-light">{showTraceInfo.element.id}</span></p>
                {'type' in showTraceInfo.element && (
                  <p>类型: <span className="text-neon-green">{showTraceInfo.element.type}</span></p>
                )}
                {'direction' in showTraceInfo.element && (
                  <p>方向: <span className="text-magnetic-purple">{showTraceInfo.element.direction}</span></p>
                )}
              </div>
              <p className="text-xs text-plasma-blue/70 mt-2">💡 工具栏对应元素已高亮</p>
            </motion.div>
          )}
        </AnimatePresence>

        {(selectedElement || selectedField) && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <motion.button
              onClick={handleRotate}
              className="flex items-center gap-2 px-4 py-2 bg-space-dark border border-plasma-blue text-plasma-blue rounded-lg font-mono text-sm hover:bg-plasma-blue/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCw className="w-4 h-4" />
              旋转
            </motion.button>
            <motion.button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-space-dark border border-energy-red text-energy-red rounded-lg font-mono text-sm hover:bg-energy-red/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="w-4 h-4" />
              删除
            </motion.button>
          </div>
        )}

        {draggingTool && (
          <div className="absolute top-4 left-4 bg-plasma-blue/20 border border-plasma-blue text-plasma-blue px-3 py-1 rounded-lg font-mono text-sm">
            正在放置: {draggingTool.name} | 位置: ({mousePos.x}, {mousePos.y})
          </div>
        )}
      </div>

      <div className="mt-3 text-xs font-mono text-tech-light flex justify-between">
        <span>提示: Shift + 点击元素 查看溯源信息</span>
        <span>坐标: ({mousePos.x}, {mousePos.y})</span>
      </div>
    </div>
  );
}
