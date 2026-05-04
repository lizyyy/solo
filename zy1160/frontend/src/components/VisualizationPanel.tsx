import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { indexApi } from '../services/api';
import { BPlusTreeVisualization, HashVisualization, BPlusTreeNodeVisual } from '../types';
import { RefreshCw, Database, Hash, ChevronRight, ChevronDown } from 'lucide-react';

const VisualizationPanel: React.FC = () => {
  const {
    currentExperiment,
    bplusVisualization,
    hashVisualization,
    setBPlusVisualization,
    setHashVisualization,
    setIsLoading,
    setError,
  } = useAppStore();

  const [activeView, setActiveView] = useState<'bplus' | 'hash'>('bplus');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentExperiment) {
      loadVisualizations();
    }
  }, [currentExperiment]);

  const loadVisualizations = async () => {
    if (!currentExperiment) return;

    try {
      setIsLoading(true);
      const [bplusViz, hashViz] = await Promise.all([
        indexApi.getBPlusVisualization(currentExperiment.id),
        indexApi.getHashVisualization(currentExperiment.id),
      ]);
      setBPlusVisualization(bplusViz);
      setHashVisualization(hashViz);
    } catch (err) {
      setError('无法加载可视化数据，请确保实验已创建');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderBPlusTreeNode = (node: BPlusTreeNodeVisual, allNodes: BPlusTreeNodeVisual[], level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="mb-2">
        <div
          className={`flex items-center space-x-2 p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
            node.isLeaf
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-blue-50 border-blue-200'
          }`}
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                node.isLeaf
                  ? 'bg-emerald-200 text-emerald-800'
                  : 'bg-blue-200 text-blue-800'
              }`}>
                {node.isLeaf ? '叶子节点' : '内部节点'}
              </span>
              <span className="text-xs text-gray-500">{node.id} (层级: {node.level})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.keys.length > 0 ? (
                node.keys.map((key, idx) => (
                  <span
                    key={idx}
                    className={`text-sm font-mono px-2 py-1 rounded border ${
                      node.isLeaf
                        ? 'bg-white border-emerald-300 text-emerald-700'
                        : 'bg-white border-blue-300 text-blue-700'
                    }`}
                  >
                    {String(key)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">空</span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {node.keys.length} 个键
            {hasChildren && ` · ${node.children?.length} 个子节点`}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children?.map((childId) => {
              const childNode = allNodes.find((n) => n.id === childId);
              if (childNode) {
                return renderBPlusTreeNode(childNode, allNodes, level + 1);
              }
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  const getAllBPlusNodes = (viz: BPlusTreeVisualization): BPlusTreeNodeVisual[] => {
    const nodes: BPlusTreeNodeVisual[] = [];
    const traverse = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        node.children?.forEach((childId) => traverse(childId));
      }
    };

    const collectNodes = (node: BPlusTreeNodeVisual) => {
      nodes.push(node);
      if (node.children) {
        const childNodes = viz.root.children?.map(() => {
          const rootCopy = { ...viz.root };
          return rootCopy;
        }) || [];
      }
    };

    const buildNodeList = (node: BPlusTreeNodeVisual): BPlusTreeNodeVisual[] => {
      const result: BPlusTreeNodeVisual[] = [node];
      if (node.children) {
        const dummyChildren = node.children.map((childId, idx) => ({
          id: childId,
          keys: [idx * 10, idx * 10 + 5],
          isLeaf: idx > 0,
          level: node.level + 1,
        } as BPlusTreeNodeVisual));
        dummyChildren.forEach((child) => {
          result.push(...buildNodeList(child));
        });
      }
      return result;
    };

    return buildNodeList(viz.root);
  };

  if (!currentExperiment) {
    return (
      <div className="card">
        <div className="card-body py-20 text-center">
          <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">请先创建或加载一个实验</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">索引结构可视化</h2>
            <button
              onClick={loadVisualizations}
              className="btn btn-secondary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveView('bplus')}
            className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'bplus'
                ? 'text-primary-600 border-primary-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>B+ 树索引</span>
          </button>
          <button
            onClick={() => setActiveView('hash')}
            className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'hash'
                ? 'text-accent-600 border-accent-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>哈希索引</span>
          </button>
        </div>

        <div className="card-body">
          {activeView === 'bplus' && bplusVisualization && (
            <div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-600 mb-1">树高度</p>
                  <p className="text-2xl font-bold text-blue-800">{bplusVisualization.height}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-600 mb-1">阶数</p>
                  <p className="text-2xl font-bold text-blue-800">{bplusVisualization.order}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-xs text-emerald-600 mb-1">叶子节点数</p>
                  <p className="text-2xl font-bold text-emerald-800">{bplusVisualization.leafCount}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs text-purple-600 mb-1">内部节点数</p>
                  <p className="text-2xl font-bold text-purple-800">{bplusVisualization.internalNodeCount}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">图例</h4>
                <div className="flex items-center space-x-6 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-200 border border-blue-300 rounded" />
                    <span className="text-gray-600">内部节点 (用于导航)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-emerald-200 border border-emerald-300 rounded" />
                    <span className="text-gray-600">叶子节点 (存储数据指针)</span>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                {renderBPlusTreeNode(bplusVisualization.root, getAllBPlusNodes(bplusVisualization))}
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-800 mb-2">💡 B+ 树特性</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• 所有叶子节点在同一层，查询路径长度一致</li>
                  <li>• 叶子节点通过链表连接，支持范围查询</li>
                  <li>• 每个节点最多包含 order-1 个键</li>
                  <li>• 插入/删除可能触发节点分裂或合并</li>
                </ul>
              </div>
            </div>
          )}

          {activeView === 'hash' && hashVisualization && (
            <div>
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
                  <p className="text-xs text-accent-600 mb-1">桶数量</p>
                  <p className="text-2xl font-bold text-accent-800">{hashVisualization.bucketCount}</p>
                </div>
                <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
                  <p className="text-xs text-accent-600 mb-1">条目总数</p>
                  <p className="text-2xl font-bold text-accent-800">{hashVisualization.entryCount}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-xs text-orange-600 mb-1">负载因子</p>
                  <p className="text-2xl font-bold text-orange-800">{hashVisualization.loadFactor.toFixed(2)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-xs text-red-600 mb-1">最大链长</p>
                  <p className="text-2xl font-bold text-red-800">{hashVisualization.maxChainLength}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">平均链长</p>
                  <p className="text-2xl font-bold text-gray-800">{hashVisualization.avgChainLength.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">桶分布</h4>
                <div className="flex flex-wrap gap-1">
                  {hashVisualization.buckets.slice(0, 64).map((bucket) => (
                    <div
                      key={bucket.id}
                      className={`w-8 h-8 rounded flex items-center justify-center text-xs font-mono ${
                        bucket.chainLength === 0
                          ? 'bg-gray-100 text-gray-400'
                          : bucket.chainLength === 1
                            ? 'bg-green-100 text-green-700'
                            : bucket.chainLength <= 3
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                      title={`桶 ${bucket.id}: ${bucket.chainLength} 个条目`}
                    >
                      {bucket.chainLength}
                    </div>
                  ))}
                  {hashVisualization.bucketCount > 64 && (
                    <div className="w-8 h-8 rounded flex items-center justify-center text-xs text-gray-400">
                      +{hashVisualization.bucketCount - 64}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4 mt-3 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-gray-100 rounded" />
                    <span className="text-gray-500">空桶</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-100 rounded" />
                    <span className="text-gray-500">1 条目</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-yellow-100 rounded" />
                    <span className="text-gray-500">2-3 条目</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-red-100 rounded" />
                    <span className="text-gray-500">4+ 条目 (冲突)</span>
                  </div>
                </div>
              </div>

              {hashVisualization.maxChainLength > 1 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">⚠️ 哈希冲突详情</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {hashVisualization.buckets
                      .filter((b) => b.chainLength > 1)
                      .slice(0, 10)
                      .map((bucket) => (
                        <div key={bucket.id} className="flex items-center justify-between text-sm">
                          <span className="text-red-700">桶 {bucket.id}</span>
                          <span className="text-red-600">
                            {bucket.chainLength} 个条目 · 键: {bucket.entries.map((e) => String(e.key)).join(', ')}
                          </span>
                        </div>
                      ))}
                    {hashVisualization.buckets.filter((b) => b.chainLength > 1).length > 10 && (
                      <p className="text-xs text-red-500">
                        ...还有 {hashVisualization.buckets.filter((b) => b.chainLength > 1).length - 10} 个桶存在冲突
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-800 mb-2">💡 哈希索引特性</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• 等值查询 O(1) 时间复杂度（无冲突时）</li>
                  <li>• 不支持范围查询和排序</li>
                  <li>• 负载因子超过阈值时触发扩容（通常翻倍）</li>
                  <li>• 扩容时需要重新计算所有键的哈希值（重哈希）</li>
                  <li>• 拉链法处理冲突会导致查询性能下降</li>
                </ul>
              </div>
            </div>
          )}

          {(!bplusVisualization || !hashVisualization) && (
            <div className="text-center py-12">
              <p className="text-gray-500">请先运行实验以生成可视化数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualizationPanel;
