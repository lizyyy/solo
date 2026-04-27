import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useMindMaps } from '../../context/AppContext';
import { MindMap as MindMapType, MindMapNode } from '../../types';
import './MindMap.css';

interface EditorState {
  selectedNodeId: string | null;
  isEditing: boolean;
  editValue: string;
}

export const MindMapPage: React.FC = () => {
  const { mindMaps, addMindMap, deleteMindMap, addNode, updateNode, deleteNode, getMindMapById } = useMindMaps();
  
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapType, setNewMapType] = useState<'curve' | 'tree'>('tree');
  const [newMapRootLabel, setNewMapRootLabel] = useState('');
  
  const [editorState, setEditorState] = useState<EditorState>({
    selectedNodeId: null,
    isEditing: false,
    editValue: ''
  });

  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState('');

  const selectedMap = selectedMapId ? getMindMapById(selectedMapId) : null;

  const handleCreateMap = () => {
    if (newMapTitle.trim() && newMapRootLabel.trim()) {
      addMindMap(newMapTitle, newMapType, newMapRootLabel);
      setShowCreateModal(false);
      setNewMapTitle('');
      setNewMapRootLabel('');
      setNewMapType('tree');
    }
  };

  const handleEditMap = (map: MindMapType) => {
    setSelectedMapId(map.id);
    setViewMode('editor');
    setEditorState({
      selectedNodeId: null,
      isEditing: false,
      editValue: ''
    });
  };

  const handleDeleteMap = (e: React.MouseEvent, mapId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个思维导图吗？')) {
      deleteMindMap(mapId);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedMapId(null);
    setEditorState({
      selectedNodeId: null,
      isEditing: false,
      editValue: ''
    });
  };

  const findNodeById = useCallback((root: MindMapNode, nodeId: string): MindMapNode | null => {
    if (root.id === nodeId) return root;
    for (const child of root.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
    return null;
  }, []);

  const handleNodeClick = (nodeId: string) => {
    if (!selectedMap) return;
    const node = findNodeById(selectedMap.root, nodeId);
    if (node) {
      setEditorState({
        selectedNodeId: nodeId,
        isEditing: false,
        editValue: node.label
      });
    }
  };

  const handleStartEdit = () => {
    if (editorState.selectedNodeId) {
      setEditorState(prev => ({
        ...prev,
        isEditing: true
      }));
    }
  };

  const handleSaveEdit = () => {
    if (editorState.selectedNodeId && selectedMapId && editorState.editValue.trim()) {
      updateNode(selectedMapId, editorState.selectedNodeId, editorState.editValue.trim());
      setEditorState(prev => ({
        ...prev,
        isEditing: false
      }));
    }
  };

  const handleCancelEdit = () => {
    if (!selectedMap || !editorState.selectedNodeId) return;
    const node = findNodeById(selectedMap.root, editorState.selectedNodeId);
    setEditorState(prev => ({
      ...prev,
      isEditing: false,
      editValue: node?.label || prev.editValue
    }));
  };

  const handleAddChildNode = () => {
    if (editorState.selectedNodeId && selectedMapId) {
      setShowAddNodeModal(true);
      setNewNodeLabel('');
    }
  };

  const handleConfirmAddChild = () => {
    if (editorState.selectedNodeId && selectedMapId && newNodeLabel.trim()) {
      addNode(selectedMapId, editorState.selectedNodeId, {
        label: newNodeLabel.trim(),
        type: 'branch',
        questionIds: []
      });
      setShowAddNodeModal(false);
      setNewNodeLabel('');
    }
  };

  const handleDeleteCurrentNode = () => {
    if (!editorState.selectedNodeId || !selectedMapId || !selectedMap) return;
    
    const node = findNodeById(selectedMap.root, editorState.selectedNodeId);
    if (!node) return;
    
    if (node.type === 'root') {
      alert('不能删除根节点');
      return;
    }
    
    if (confirm(`确定要删除节点"${node.label}"及其所有子节点吗？`)) {
      deleteNode(selectedMapId, editorState.selectedNodeId);
      setEditorState({
        selectedNodeId: null,
        isEditing: false,
        editValue: ''
      });
    }
  };

  const getAllNodes = useCallback((root: MindMapNode): { node: MindMapNode; level: number }[] => {
    const result: { node: MindMapNode; level: number }[] = [{ node: root, level: 0 }];
    
    const traverse = (node: MindMapNode, level: number) => {
      node.children.forEach(child => {
        result.push({ node: child, level: level + 1 });
        traverse(child, level + 1);
      });
    };
    
    traverse(root, 0);
    return result;
  }, []);

  const renderTreePreview = (root: MindMapNode) => {
    return (
      <div className="preview-tree">
        <div className="tree-root">
          {root.label.length > 2 ? root.label.substring(0, 2) : root.label}
        </div>
        {root.children.length > 0 && (
          <>
            <div className="tree-branch left-top">
              <div className="branch-node">
                {root.children[0]?.label.length > 3 
                  ? root.children[0].label.substring(0, 3) 
                  : root.children[0]?.label || '...'}
              </div>
            </div>
            {root.children[1] && (
              <div className="tree-branch right-top">
                <div className="branch-node">
                  {root.children[1].label.length > 3 
                    ? root.children[1].label.substring(0, 3) 
                    : root.children[1].label}
                </div>
              </div>
            )}
            {root.children[2] && (
              <div className="tree-branch left-bottom">
                <div className="branch-node">
                  {root.children[2].label.length > 3 
                    ? root.children[2].label.substring(0, 3) 
                    : root.children[2].label}
                </div>
              </div>
            )}
            {root.children[3] && (
              <div className="tree-branch right-bottom">
                <div className="branch-node">
                  {root.children[3].label.length > 3 
                    ? root.children[3].label.substring(0, 3) 
                    : root.children[3].label}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderCurvePreview = (root: MindMapNode) => {
    const level1Nodes = root.children;
    const level2Nodes = level1Nodes.flatMap(c => c.children);

    return (
      <div className="preview-curve">
        <div className="curve-node root">
          {root.label.length > 2 ? root.label.substring(0, 2) : root.label}
        </div>
        {level1Nodes.slice(0, 4).map((node, index) => {
          const angles = [180, 270, 0, 90];
          const angle = angles[index];
          const radians = (angle * Math.PI) / 180;
          const radius = 50;
          const left = 50 + Math.cos(radians) * radius;
          const top = 50 + Math.sin(radians) * radius;

          return (
            <div
              key={node.id}
              className="curve-node level1"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {node.label.length > 1 ? node.label.substring(0, 1) : node.label}
            </div>
          );
        })}
        {level2Nodes.slice(0, 8).map((node, index) => {
          const angles = [135, 225, 315, 45, 180, 270, 0, 90];
          const angle = angles[index];
          const radians = (angle * Math.PI) / 180;
          const radius = 75;
          const left = 50 + Math.cos(radians) * radius;
          const top = 50 + Math.sin(radians) * radius;

          return (
            <div
              key={node.id}
              className="curve-node level2"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {node.label.length > 1 ? node.label.substring(0, 1) : node.label}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTreeSVG = (root: MindMapNode, width: number, height: number) => {
    const positions: Map<string, { x: number; y: number }> = new Map();
    const allNodes = getAllNodes(root);
    
    const maxLevel = Math.max(...allNodes.map(n => n.level));
    
    const calculatePositions = (node: MindMapNode, level: number, index: number, total: number) => {
      const levelHeight = height / (maxLevel + 2);
      const y = levelHeight + level * levelHeight;
      const spacing = width / (total + 1);
      const x = spacing * (index + 1);
      
      positions.set(node.id, { x, y });
      
      if (node.children.length > 0) {
        node.children.forEach((child, childIndex) => {
          calculatePositions(child, level + 1, childIndex, Math.max(node.children.length, 4));
        });
      }
    };

    calculatePositions(root, 0, 1, Math.max(root.children.length, 4));

    const renderLines = (node: MindMapNode): JSX.Element[] => {
      const parentPos = positions.get(node.id);
      if (!parentPos) return [];

      return node.children.flatMap(child => {
        const childPos = positions.get(child.id);
        if (!childPos) return [];

        const lines: JSX.Element[] = [];
        
        lines.push(
          <path
            key={`line-${node.id}-${child.id}`}
            className="tree-line"
            d={`M ${parentPos.x} ${parentPos.y} Q ${parentPos.x + (childPos.x - parentPos.x) / 2} ${parentPos.y} ${parentPos.x + (childPos.x - parentPos.x) / 2} ${(parentPos.y + childPos.y) / 2} Q ${parentPos.x + (childPos.x - parentPos.x) / 2} ${childPos.y} ${childPos.x} ${childPos.y}`}
          />
        );

        lines.push(...renderLines(child));
        return lines;
      });
    };

    const renderNodes = (node: MindMapNode): JSX.Element[] => {
      const pos = positions.get(node.id);
      if (!pos) return [];

      const nodes: JSX.Element[] = [];
      const nodeSize = node.type === 'root' ? 60 : node.type === 'branch' ? 50 : 40;
      const fontSize = node.type === 'root' ? 12 : 10;
      const isSelected = editorState.selectedNodeId === node.id;

      nodes.push(
        <g key={node.id} className="node" onClick={() => handleNodeClick(node.id)} style={{ cursor: 'pointer' }}>
          <circle
            className={`node-circle ${node.type} ${isSelected ? 'selected' : ''}`}
            cx={pos.x}
            cy={pos.y}
            r={nodeSize / 2}
          />
          {isSelected && (
            <circle
              className="node-selected-ring"
              cx={pos.x}
              cy={pos.y}
              r={nodeSize / 2 + 4}
            />
          )}
          <text
            className="node-text"
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
          >
            {node.label.length > 4 ? node.label.substring(0, 4) : node.label}
          </text>
          {node.children.length > 0 && (
            <text
              className="node-children-count"
              x={pos.x + nodeSize / 2 - 5}
              y={pos.y - nodeSize / 2 + 10}
            >
              {node.children.length}
            </text>
          )}
        </g>
      );

      node.children.forEach(child => {
        nodes.push(...renderNodes(child));
      });

      return nodes;
    };

    return (
      <>
        {renderLines(root)}
        {renderNodes(root)}
      </>
    );
  };

  const renderCurveSVG = (root: MindMapNode, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const positions: Map<string, { x: number; y: number; angle: number; radius: number; level: number }> = new Map();
    
    positions.set(root.id, { x: centerX, y: centerY, angle: 0, radius: 0, level: 0 });

    const calculateCurvePositions = (node: MindMapNode, parentAngle: number, level: number, siblingIndex: number, siblingCount: number) => {
      if (level === 0) return;
      
      const radius = 80 + level * 70;
      let angle: number;
      
      if (level === 1) {
        angle = (siblingIndex / Math.max(siblingCount, 1)) * 360;
      } else {
        const spreadAngle = Math.min(60, 360 / Math.max(siblingCount, 1));
        const startAngle = parentAngle - (spreadAngle * (siblingCount - 1)) / 2;
        angle = startAngle + siblingIndex * spreadAngle;
      }

      const radians = (angle * Math.PI) / 180;
      const x = centerX + Math.cos(radians) * radius;
      const y = centerY + Math.sin(radians) * radius;
      
      positions.set(node.id, { x, y, angle, radius, level });

      node.children.forEach((child, childIndex) => {
        calculateCurvePositions(child, angle, level + 1, childIndex, node.children.length);
      });
    };

    root.children.forEach((child, index) => {
      calculateCurvePositions(child, 0, 1, index, root.children.length);
    });

    const renderCurveLines = (node: MindMapNode, parentPos?: { x: number; y: number; angle: number; radius: number; level: number }): JSX.Element[] => {
      const pos = positions.get(node.id);
      if (!pos) return [];

      const lines: JSX.Element[] = [];
      
      if (parentPos && pos.level > 0) {
        const radians = (pos.angle * Math.PI) / 180;
        const controlX = centerX + Math.cos(radians) * pos.radius / 2;
        const controlY = centerY + Math.sin(radians) * pos.radius / 2;
        
        lines.push(
          <path
            key={`line-${node.id}`}
            className="curve-path"
            d={`M ${centerX} ${centerY} Q ${controlX} ${controlY} ${pos.x} ${pos.y}`}
          />
        );
      }

      node.children.forEach(child => {
        lines.push(...renderCurveLines(child, pos));
      });

      return lines;
    };

    const renderCurveNodes = (node: MindMapNode): JSX.Element[] => {
      const pos = positions.get(node.id);
      if (!pos) return [];

      const nodes: JSX.Element[] = [];
      const nodeSize = pos.level === 0 ? 70 : pos.level === 1 ? 50 : 35;
      const fontSize = pos.level === 0 ? 14 : pos.level === 1 ? 12 : 10;
      const isSelected = editorState.selectedNodeId === node.id;

      nodes.push(
        <g key={node.id} className="node" onClick={() => handleNodeClick(node.id)} style={{ cursor: 'pointer' }}>
          <circle
            className={`node-circle ${node.type} ${isSelected ? 'selected' : ''}`}
            cx={pos.x}
            cy={pos.y}
            r={nodeSize / 2}
          />
          {isSelected && (
            <circle
              className="node-selected-ring"
              cx={pos.x}
              cy={pos.y}
              r={nodeSize / 2 + 4}
            />
          )}
          <text
            className="node-text"
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
          >
            {node.label.length > (pos.level === 0 ? 4 : 2) 
              ? node.label.substring(0, pos.level === 0 ? 4 : 2) 
              : node.label}
          </text>
        </g>
      );

      node.children.forEach(child => {
        nodes.push(...renderCurveNodes(child));
      });

      return nodes;
    };

    return (
      <>
        {renderCurveLines(root)}
        {renderCurveNodes(root)}
      </>
    );
  };

  const selectedNode = selectedMap && editorState.selectedNodeId 
    ? findNodeById(selectedMap.root, editorState.selectedNodeId)
    : null;

  if (viewMode === 'editor' && selectedMap) {
    return (
      <div className="mind-map-page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="back-btn"
              onClick={handleBackToList}
              style={{ margin: 0 }}
            >
              <span>←</span>
              <span>返回列表</span>
            </button>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>{selectedMap.title}</h1>
              <p className="page-subtitle" style={{ margin: 0 }}>
                {selectedMap.type === 'tree' ? '树枝曲线' : '普通曲线'}模式
              </p>
            </div>
          </div>
        </div>

        <div className="editor-layout">
          <div className="editor-canvas-area">
            <div className="editor-view">
              <div className="editor-header">
                <span className="editor-title">思维导图编辑器</span>
                <div className="editor-actions">
                  <span className="editor-hint">点击节点进行编辑</span>
                </div>
              </div>

              <div className="canvas-container">
                <svg
                  className="svg-canvas"
                  viewBox="0 0 800 500"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="rootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                  
                  {selectedMap.type === 'tree'
                    ? renderTreeSVG(selectedMap.root, 800, 500)
                    : renderCurveSVG(selectedMap.root, 800, 500)}
                </svg>
              </div>
            </div>
          </div>

          <div className="editor-sidebar">
            <div className="sidebar-section">
              <h3 className="sidebar-title">节点操作</h3>
              
              {selectedNode ? (
                <div className="node-info-panel">
                  <div className="node-info-header">
                    <span className={`node-badge ${selectedNode.type}`}>
                      {selectedNode.type === 'root' ? '根节点' : selectedNode.type === 'branch' ? '分支' : '叶子'}
                    </span>
                  </div>
                  
                  {editorState.isEditing ? (
                    <div className="node-edit-form">
                      <label className="form-label">节点名称</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editorState.editValue}
                        onChange={(e) => setEditorState(prev => ({ ...prev, editValue: e.target.value }))}
                        autoFocus
                      />
                      <div className="form-actions">
                        <button className="btn-cancel" onClick={handleCancelEdit}>取消</button>
                        <button className="btn-save" onClick={handleSaveEdit} disabled={!editorState.editValue.trim()}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="node-info-row">
                        <span className="node-info-label">名称</span>
                        <span className="node-info-value">{selectedNode.label}</span>
                      </div>
                      <div className="node-info-row">
                        <span className="node-info-label">子节点</span>
                        <span className="node-info-value">{selectedNode.children.length} 个</span>
                      </div>
                      <div className="node-info-row">
                        <span className="node-info-label">关联题目</span>
                        <span className="node-info-value">{selectedNode.questionIds.length} 道</span>
                      </div>
                      
                      <div className="node-action-buttons">
                        <button className="node-action-btn primary" onClick={handleStartEdit}>
                          ✏️ 编辑
                        </button>
                        <button className="node-action-btn success" onClick={handleAddChildNode}>
                          ➕ 添加子节点
                        </button>
                        {selectedNode.type !== 'root' && (
                          <button className="node-action-btn danger" onClick={handleDeleteCurrentNode}>
                            🗑️ 删除
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="no-selection-hint">
                  <div className="hint-icon">👆</div>
                  <div className="hint-text">点击画布中的节点进行选择</div>
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <h3 className="sidebar-title">操作指南</h3>
              <div className="guide-list">
                <div className="guide-item">
                  <span className="guide-icon">🔘</span>
                  <span>点击节点选中</span>
                </div>
                <div className="guide-item">
                  <span className="guide-icon">✏️</span>
                  <span>选中后可编辑节点名称</span>
                </div>
                <div className="guide-item">
                  <span className="guide-icon">➕</span>
                  <span>可为任意节点添加子节点</span>
                </div>
                <div className="guide-item">
                  <span className="guide-icon">🗑️</span>
                  <span>可删除非根节点及其子节点</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showAddNodeModal && (
          <div className="modal-overlay" onClick={() => setShowAddNodeModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">添加子节点</h2>
                <button className="close-btn" onClick={() => setShowAddNodeModal(false)}>✕</button>
              </div>
              <div className="form-group">
                <label className="form-label">父节点</label>
                <div className="parent-node-display">
                  {selectedNode?.label}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">子节点名称</label>
                <input
                  type="text"
                  className="form-input"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  placeholder="请输入节点名称"
                  autoFocus
                />
              </div>
              <div className="form-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowAddNodeModal(false)}
                >
                  取消
                </button>
                <button
                  className="submit-btn"
                  onClick={handleConfirmAddChild}
                  disabled={!newNodeLabel.trim()}
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mind-map-page">
      <div className="page-header">
        <h1 className="page-title">思维导图</h1>
        <p className="page-subtitle">可视化你的知识结构，建立知识关联</p>
      </div>

      <div className="toolbar">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <span>📋</span>
            <span>列表视图</span>
          </button>
        </div>
        <button className="create-btn" onClick={() => setShowCreateModal(true)}>
          <span>➕</span>
          <span>创建思维导图</span>
        </button>
      </div>

      <div className="mind-map-grid">
        {mindMaps.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌳</div>
            <div className="empty-title">暂无思维导图</div>
            <div className="empty-text">
              创建思维导图来可视化你的知识结构，帮助建立知识点之间的关联
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              创建第一个思维导图
            </button>
          </div>
        ) : (
          mindMaps.map((map) => (
            <div
              key={map.id}
              className="mind-map-card"
              onClick={() => handleEditMap(map)}
            >
              <div className="mind-map-preview">
                <span className="map-type-badge">
                  {map.type === 'tree' ? '🌳 树枝曲线' : '📈 普通曲线'}
                </span>
                {map.type === 'tree'
                  ? renderTreePreview(map.root)
                  : renderCurvePreview(map.root)}
              </div>
              <div className="mind-map-info">
                <span className="mind-map-title">{map.title}</span>
                <div className="mind-map-meta">
                  <span>
                    {getAllNodes(map.root).length} 个节点
                  </span>
                  <span>
                    创建于 {format(new Date(map.createdAt), 'yyyy-MM-dd')}
                  </span>
                </div>
              </div>
              <div className="mind-map-actions">
                <button
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditMap(map);
                  }}
                >
                  编辑
                </button>
                <button
                  className="action-btn delete"
                  onClick={(e) => handleDeleteMap(e, map.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">创建思维导图</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">思维导图名称</label>
              <input
                type="text"
                className="form-input"
                value={newMapTitle}
                onChange={(e) => setNewMapTitle(e.target.value)}
                placeholder="例如：高中数学知识体系"
              />
            </div>

            <div className="form-group">
              <label className="form-label">中心主题</label>
              <input
                type="text"
                className="form-input"
                value={newMapRootLabel}
                onChange={(e) => setNewMapRootLabel(e.target.value)}
                placeholder="例如：高中数学"
              />
            </div>

            <div className="form-group">
              <label className="form-label">选择布局类型</label>
              <div className="type-selector">
                <div
                  className={`type-option ${newMapType === 'tree' ? 'selected' : ''}`}
                  onClick={() => setNewMapType('tree')}
                >
                  <div className="type-icon">🌳</div>
                  <div className="type-name">树枝曲线</div>
                  <div className="type-desc">层级分明，适合结构化知识</div>
                </div>
                <div
                  className={`type-option ${newMapType === 'curve' ? 'selected' : ''}`}
                  onClick={() => setNewMapType('curve')}
                >
                  <div className="type-icon">📈</div>
                  <div className="type-name">普通曲线</div>
                  <div className="type-desc">放射状布局，适合发散思维</div>
                </div>
              </div>
            </div>

            <div className="form-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
              <button
                className="submit-btn"
                onClick={handleCreateMap}
                disabled={!newMapTitle.trim() || !newMapRootLabel.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
