import type { MaterialFile, ChangeRecord, ProofreadIssue, ChangeType, Severity } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const MATERIAL_KEYWORDS = ['补充', '新增', '完善', '补上', '更新素材', '添加', '附', '备注', '说明'];

const CONCLUSION_KEYWORDS = ['修改', '调整', '更正', '定稿', '变更', '改为', '更改为', '修正', '调整为'];

export const detectChangeType = (oldValue: string, newValue: string): ChangeType => {
  const diff = newValue.length - oldValue.length;
  const isAddition = diff > 0 && oldValue.split('').every((char, i) => newValue.includes(char));
  
  if (isAddition) {
    return 'material';
  }

  const lowerNew = newValue.toLowerCase();
  const lowerOld = oldValue.toLowerCase();

  for (const keyword of MATERIAL_KEYWORDS) {
    if (lowerNew.includes(keyword)) {
      return 'material';
    }
  }

  for (const keyword of CONCLUSION_KEYWORDS) {
    if (lowerNew.includes(keyword)) {
      return 'conclusion';
    }
  }

  if (oldValue.trim() !== newValue.trim() && !newValue.includes(oldValue)) {
    return 'conclusion';
  }

  return 'material';
};

export const detectSeverity = (changeType: ChangeType, field: string, oldValue: string, newValue: string): Severity => {
  if (changeType === 'conclusion') {
    const colorPattern = /^#[0-9A-Fa-f]{6}$/;
    if (colorPattern.test(oldValue) || colorPattern.test(newValue)) {
      return 'medium';
    }
    if (field.includes('地点') || field.includes('时间') || field.includes('title')) {
      return 'high';
    }
    return 'medium';
  }
  return 'low';
};

export const generateChangeDescription = (changeType: ChangeType, field: string, oldValue: string, newValue: string): { description: string; suggestion: string } => {
  if (changeType === 'material') {
    return {
      description: `补充了${field}相关的内容`,
      suggestion: '这是补充材料，不影响原有结论，可以直接确认',
    };
  }
  return {
    description: `${field}从"${oldValue}"改为"${newValue}"`,
    suggestion: '这是重要变更，请核对是否正确',
  };
};

export const compareFiles = (oldFile: MaterialFile, newFile: MaterialFile): ChangeRecord[] => {
  const changes: ChangeRecord[] = [];
  
  if (oldFile.content !== newFile.content) {
    const changeType = detectChangeType(oldFile.content, newFile.content);
    const severity = detectSeverity(changeType, oldFile.name, oldFile.content, newFile.content);
    const { description, suggestion } = generateChangeDescription(changeType, oldFile.name, oldFile.content, newFile.content);

    changes.push({
      id: generateId(),
      fileId: newFile.id,
      field: 'content',
      oldValue: oldFile.content,
      newValue: newFile.content,
      type: changeType,
      category: changeType === 'material' ? '补充信息' : '内容变更',
      severity,
      description,
      suggestion,
      timestamp: Date.now(),
    });
  }

  return changes;
};

export const analyzeColorChanges = (content: string): ChangeRecord[] => {
  const changes: ChangeRecord[] = [];
  
  try {
    const parsed = JSON.parse(content);
    Object.entries(parsed).forEach(([key, value]) => {
      const changeType: ChangeType = 'conclusion';
      changes.push({
        id: generateId(),
        fileId: generateId(),
        field: key,
        oldValue: '',
        newValue: String(value),
        type: changeType,
        category: '色值配置',
        severity: 'medium',
        description: `${key}色值设置为${value}`,
        suggestion: '请确认该色值是否符合设计规范',
        timestamp: Date.now(),
      });
    });
  } catch {
    // not JSON
  }
  
  return changes;
};

export const generateHumanFriendlyIssue = (file: MaterialFile): ProofreadIssue[] => {
  const issues: ProofreadIssue[] = [];
  
  const lines = file.content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('上海') && line.includes('北京')) {
      issues.push({
        id: generateId(),
        fileId: file.id,
        type: 'warning',
        title: '地点信息需要确认',
        message: '这段文字里同时提到了上海和北京，活动地点到底是哪里呢？',
        suggestion: '建议和市场部同事再核对一下最终地点',
        location: { line: index + 1 },
        resolved: false,
      });
    }
  });
  
  if (file.type === 'color') {
    try {
      const colors = JSON.parse(file.content);
      if (colors.accent === '#ef4444') {
        issues.push({
          id: generateId(),
          fileId: file.id,
          type: 'warning',
          title: '红色可能太亮了',
          message: '这个红色 #ef4444 在屏幕上看还行，但印刷出来可能会有点飘。',
          suggestion: '试试 #dc2626 这个颜色，打印出来会更稳重一些',
          location: { field: 'accent' },
          resolved: false,
        });
      }
    } catch {
      // ignore
    }
  }
  
  return issues;
};

export const proofreadFiles = (files: MaterialFile[]): { changes: ChangeRecord[]; issues: ProofreadIssue[] } => {
  const allChanges: ChangeRecord[] = [];
  const allIssues: ProofreadIssue[] = [];

  files.forEach((file) => {
    const fileChanges = analyzeColorChanges(file.content);
    allChanges.push(...fileChanges);
    
    const fileIssues = generateHumanFriendlyIssue(file);
    allIssues.push(...fileIssues);
  });

  return { changes: allChanges, issues: allIssues };
};

export const generateContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};
