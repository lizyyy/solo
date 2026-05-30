import { Panel } from './ui/Panel';
import { X, Database } from 'lucide-react';
import { useBridgeStore } from '@/store/useBridgeStore';

export function DetailPanel() {
  const model = useBridgeStore(state => state.model);
  const selectedNodeId = useBridgeStore(state => state.scene.selectedNodeId);
  const selectedElementId = useBridgeStore(state => state.scene.selectedElementId);
  const selectNode = useBridgeStore(state => state.selectNode);
  const selectElement = useBridgeStore(state => state.selectElement);
  
  const selectedNode = model?.nodes.find(n => n.id === selectedNodeId);
  const selectedElement = model?.elements.find(e => e.id === selectedElementId);
  
  if (!selectedNode && !selectedElement) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
      <Panel className="w-80">
        <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <h3 className="text-sm font-medium text-zinc-200">
            {selectedNode ? '节点明细' : '单元明细'}
          </h3>
        </div>
        <button
          onClick={() => {
            selectNode(null);
            selectElement(null);
          }}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {selectedNode && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-zinc-500">节点ID</div>
            <div className="text-zinc-200 font-mono">{selectedNode.id}</div>
            <div className="text-zinc-500">X 坐标</div>
            <div className="text-blue-400 font-mono">{selectedNode.x.toFixed(2)} m</div>
            <div className="text-zinc-500">Y 坐标</div>
            <div className="text-blue-400 font-mono">{selectedNode.y.toFixed(2)} m</div>
            <div className="text-zinc-500">Z 坐标</div>
            <div className="text-blue-400 font-mono">{selectedNode.z.toFixed(2)} m</div>
          </div>
          
          <div className="pt-3 border-t border-zinc-700">
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <Database className="w-3 h-3" />
              数据来源
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">来源文件</span>
                <span className="text-zinc-300">{selectedNode._source.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">材料类型</span>
                <span className={selectedNode._source.sourceType === 'original' ? 'text-blue-400' : 'text-emerald-400'}>
                  {selectedNode._source.sourceType === 'original' ? '原始材料' : '处理结果'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {selectedElement && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-zinc-500">单元ID</div>
            <div className="text-zinc-200 font-mono">{selectedElement.id}</div>
            <div className="text-zinc-500">单元类型</div>
            <div className="text-zinc-200">{selectedElement.type === 'beam' ? '梁单元' : selectedElement.type === 'pier' ? '桥墩' : '桥面板'}</div>
            <div className="text-zinc-500">起始节点</div>
            <div className="text-blue-400 font-mono">{selectedElement.nodeStartId}</div>
            <div className="text-zinc-500">终止节点</div>
            <div className="text-blue-400 font-mono">{selectedElement.nodeEndId}</div>
          </div>
          
          <div className="pt-3 border-t border-zinc-700">
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <Database className="w-3 h-3" />
              数据来源
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">来源文件</span>
                <span className="text-zinc-300">{selectedElement._source.fileName}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      </Panel>
    </div>
  );
}
