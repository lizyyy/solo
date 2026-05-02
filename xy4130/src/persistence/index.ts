import type { StageProject, ProjectAdjustment } from '@/types';

const PROJECT_STORAGE_KEY = 'stage_light_safety_project';
const ADJUSTMENTS_STORAGE_KEY = 'stage_light_safety_adjustments';

export function saveProject(project: StageProject): void {
  try {
    const serialized = JSON.stringify(project, (_key, value) => {
      if (value instanceof Date) {
        return { __isDate: true, value: value.toISOString() };
      }
      return value;
    });
    localStorage.setItem(PROJECT_STORAGE_KEY, serialized);
  } catch (e) {
    console.error('保存项目失败:', e);
    throw new Error(`保存项目失败: ${(e as Error).message}`);
  }
}

export function loadProject(): StageProject | null {
  try {
    const serialized = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!serialized) return null;

    return JSON.parse(serialized, (_key, value) => {
      if (value && typeof value === 'object' && value.__isDate) {
        return new Date(value.value);
      }
      return value;
    });
  } catch (e) {
    console.error('加载项目失败:', e);
    return null;
  }
}

export function clearProject(): void {
  localStorage.removeItem(PROJECT_STORAGE_KEY);
}

export function saveAdjustments(adjustments: ProjectAdjustment[]): void {
  try {
    const serialized = JSON.stringify(adjustments, (_key, value) => {
      if (value instanceof Date) {
        return { __isDate: true, value: value.toISOString() };
      }
      return value;
    });
    localStorage.setItem(ADJUSTMENTS_STORAGE_KEY, serialized);
  } catch (e) {
    console.error('保存调整记录失败:', e);
  }
}

export function loadAdjustments(): ProjectAdjustment[] {
  try {
    const serialized = localStorage.getItem(ADJUSTMENTS_STORAGE_KEY);
    if (!serialized) return [];

    return JSON.parse(serialized, (_key, value) => {
      if (value && typeof value === 'object' && value.__isDate) {
        return new Date(value.value);
      }
      return value;
    });
  } catch (e) {
    console.error('加载调整记录失败:', e);
    return [];
  }
}

export function clearAdjustments(): void {
  localStorage.removeItem(ADJUSTMENTS_STORAGE_KEY);
}

export function exportProjectToFile(project: StageProject): void {
  const dataStr = JSON.stringify(project, (_key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);

  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name || 'stage_project'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAdjustmentsToFile(
  adjustments: ProjectAdjustment[],
  projectName: string = 'project'
): void {
  const dataStr = JSON.stringify(adjustments, (_key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);

  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName}_adjustments.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importProjectFromFile(file: File): Promise<StageProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const project = JSON.parse(content, (_key, value) => {
          if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.length > 10) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
              return parsed;
            }
          }
          return value;
        });
        resolve(project);
      } catch (err) {
        reject(new Error(`解析项目文件失败: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
