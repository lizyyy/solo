import type { TreeRecord, ComplaintRecord, WorkOrder, AppState } from '../types';
import { getSampleData } from '../data/sampleData';

const STORAGE_KEY = 'tree_trimming_dashboard_state';
const STORAGE_VERSION = '1.0.0';

export const calculatePriority = (
  tree: TreeRecord,
  complaints: ComplaintRecord[]
): { shadingScore: number; diseaseScore: number; complaintScore: number; totalScore: number; priority: number } => {
  const shadingScore = tree.shadingLevel;
  
  let diseaseScore = 0;
  if (tree.hasDisease) {
    diseaseScore = 80;
    if (tree.diseaseDescription && tree.diseaseDescription.includes('蛀')) {
      diseaseScore = 95;
    }
  }
  
  const treeComplaints = complaints.filter(c => c.treeId === tree.id && !c.resolved);
  const complaintCount = treeComplaints.length;
  let complaintScore = 0;
  
  if (complaintCount > 0) {
    complaintScore = Math.min(complaintCount * 25, 100);
  }
  
  const totalScore = shadingScore * 0.4 + diseaseScore * 0.35 + complaintScore * 0.25;
  const priority = Math.round(totalScore);
  
  return { shadingScore, diseaseScore, complaintScore, totalScore, priority };
};

export const generateWorkOrders = (
  trees: TreeRecord[],
  complaints: ComplaintRecord[],
  existingWorkOrders: WorkOrder[]
): WorkOrder[] => {
  const now = new Date().toISOString();
  const existingTreeIds = new Set(existingWorkOrders.map(wo => wo.treeId));
  
  const eligibleTrees = trees.filter(tree => {
    if (existingTreeIds.has(tree.id)) return false;
    const { priority } = calculatePriority(tree, complaints);
    return priority >= 40 || tree.status === 'diseased' || tree.status === 'needs_trimming';
  });
  
  const newWorkOrders: WorkOrder[] = eligibleTrees.map((tree, index) => {
    const { shadingScore, diseaseScore, complaintScore, totalScore, priority } = calculatePriority(tree, complaints);
    const treeComplaints = complaints.filter(c => c.treeId === tree.id && !c.resolved);
    
    return {
      id: `WO${Date.now()}${String(index).padStart(3, '0')}`,
      treeId: tree.id,
      complaintIds: treeComplaints.map(c => c.id),
      priority,
      shadingScore,
      diseaseScore,
      complaintScore,
      totalScore,
      status: 'pending',
      createdAt: now,
      isPublic: false
    };
  });
  
  newWorkOrders.sort((a, b) => b.priority - a.priority);
  
  return [...existingWorkOrders, ...newWorkOrders];
};

export const saveToLocalStorage = (state: AppState): void => {
  try {
    const dataToSave = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      state: {
        trees: state.trees,
        complaints: state.complaints,
        workOrders: state.workOrders
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('保存数据失败:', error);
  }
};

export const loadFromLocalStorage = (): AppState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('数据版本不兼容，使用默认数据');
      return null;
    }
    
    return parsed.state;
  } catch (error) {
    console.error('加载数据失败:', error);
    return null;
  }
};

export const clearLocalStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const resetToSampleData = (): AppState => {
  clearLocalStorage();
  const sampleData = getSampleData();
  const workOrders = generateWorkOrders(
    sampleData.trees,
    sampleData.complaints,
    []
  );
  const state = { ...sampleData, workOrders };
  saveToLocalStorage(state);
  return state;
};

export const exportToCSV = (
  data: Record<string, unknown>[],
  filename: string
): void => {
  if (data.length === 0) {
    alert('没有数据可导出');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value === undefined || value === null ? '' : String(value);
        return stringValue.includes(',') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    )
  ].join('\n');
  
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getComplaintTypeText = (type: string): string => {
  const map: Record<string, string> = {
    shading: '楼栋遮光',
    disease: '病虫害',
    resident: '居民投诉'
  };
  return map[type] || type;
};

export const getStatusText = (status: string): string => {
  const map: Record<string, string> = {
    healthy: '健康',
    needs_trimming: '需修剪',
    diseased: '病虫害',
    trimmed: '已修剪',
    pending: '待处理',
    processing: '处理中',
    completed: '已完成'
  };
  return map[status] || status;
};

export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    healthy: 'bg-green-100 text-green-800',
    needs_trimming: 'bg-yellow-100 text-yellow-800',
    diseased: 'bg-red-100 text-red-800',
    trimmed: 'bg-blue-100 text-blue-800',
    pending: 'bg-gray-100 text-gray-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const getPriorityLevel = (priority: number): { text: string; color: string } => {
  if (priority >= 80) return { text: '紧急', color: 'bg-red-500' };
  if (priority >= 60) return { text: '高', color: 'bg-orange-500' };
  if (priority >= 40) return { text: '中', color: 'bg-yellow-500' };
  return { text: '低', color: 'bg-green-500' };
};
