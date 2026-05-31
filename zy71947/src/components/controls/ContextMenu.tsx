import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useSequenceStore } from '../../store/useSequenceStore';
import { Undo2, Info, X } from 'lucide-react';

export const ContextMenu: React.FC = () => {
  const { contextMenu, hideContextMenu } = usePlaybackStore();
  const { selectCommand, undoLastAdjustment, recalculator, sequence } = useSequenceStore();

  const command = contextMenu.commandId
    ? sequence.commands.find(c => c.id === contextMenu.commandId)
    : null;

  const canUndo = command?.isManualInsert || command?.adjustments.length > 0;

  const handleUndo = useCallback(() => {
    if (contextMenu.commandId) {
      selectCommand(contextMenu.commandId);
      undoLastAdjustment();
      hideContextMenu();
    }
  }, [contextMenu.commandId, selectCommand, undoLastAdjustment, hideContextMenu]);

  const handleViewDetails = useCallback(() => {
    if (contextMenu.commandId) {
      selectCommand(contextMenu.commandId);
      hideContextMenu();
    }
  }, [contextMenu.commandId, selectCommand, hideContextMenu]);

  useEffect(() => {
    const handleClickOutside = () => hideContextMenu();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu();
    };

    if (contextMenu.visible) {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.visible, hideContextMenu]);

  if (!contextMenu.visible) return null;

  const menuX = Math.min(contextMenu.x, window.innerWidth - 200);
  const menuY = Math.min(contextMenu.y, window.innerHeight - 200);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 min-w-[180px] glass-panel py-1 shadow-xl"
        style={{ left: menuX, top: menuY }}
        onClick={e => e.stopPropagation()}
      >
        {command && (
          <div className="px-3 py-2 border-b border-space-600/50">
            <div className="text-xs text-cyber-cyan font-mono truncate">
              {command.commandName}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {command.payloadName}
            </div>
          </div>
        )}

        <button
          onClick={handleViewDetails}
          className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-gray-300 hover:bg-space-700/50 transition-colors"
        >
          <Info className="w-4 h-4 text-gray-400" />
          <span>查看详情</span>
        </button>

        {canUndo && (
          <button
            onClick={handleUndo}
            className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-cyber-purple hover:bg-cyber-purple/10 transition-colors border-t border-space-600/50"
          >
            <Undo2 className="w-4 h-4" />
            <span>撤回此次调整</span>
          </button>
        )}

        {!canUndo && (
          <div className="px-3 py-2 border-t border-space-600/50">
            <span className="text-[10px] text-gray-500">无人工调整记录</span>
          </div>
        )}

        {recalculator && !recalculator.canUndo() && (
          <div className="px-3 py-2 border-t border-space-600/50">
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
              <X className="w-3 h-3" />
              <span>历史栈已清空</span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
