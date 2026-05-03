import { Project, Fixture, PatchEntry, Cue } from '../models/types';

export interface StorableProject {
  version: string;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fixtures: Fixture[];
  patches: PatchEntry[];
  cues: Cue[];
  settings: {
    maxChannelsPerUniverse: number;
    maxPower: number;
    powerUnit: 'W' | 'kW';
    timePrecision: number;
    blackoutSafetyMargin: number;
    fadeOverlapThreshold: number;
  };
}

const CURRENT_VERSION = '1.0.0';

export function serializeProject(project: Project): string {
  const storable: StorableProject = {
    version: CURRENT_VERSION,
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: Date.now(),
    fixtures: project.fixtures,
    patches: project.patches,
    cues: project.cues,
    settings: {
      maxChannelsPerUniverse: project.settings.maxChannelsPerUniverse,
      maxPower: project.settings.maxPower,
      powerUnit: project.settings.powerUnit,
      timePrecision: project.settings.timePrecision,
      blackoutSafetyMargin: project.settings.blackoutSafetyMargin,
      fadeOverlapThreshold: project.settings.fadeOverlapThreshold
    }
  };

  return JSON.stringify(storable, null, 2);
}

export function deserializeProject(content: string): Project {
  const storable: StorableProject = JSON.parse(content);

  if (!storable.version) {
    throw new Error('无效的项目文件：缺少版本信息');
  }

  if (!isCompatibleVersion(storable.version)) {
    throw new Error(`不兼容的项目版本：${storable.version}，当前版本：${CURRENT_VERSION}`);
  }

  return {
    id: storable.id,
    name: storable.name,
    createdAt: storable.createdAt,
    updatedAt: storable.updatedAt,
    fixtures: storable.fixtures,
    patches: storable.patches,
    cues: storable.cues,
    settings: {
      maxChannelsPerUniverse: storable.settings.maxChannelsPerUniverse,
      maxPower: storable.settings.maxPower,
      powerUnit: storable.settings.powerUnit,
      timePrecision: storable.settings.timePrecision,
      blackoutSafetyMargin: storable.settings.blackoutSafetyMargin,
      fadeOverlapThreshold: storable.settings.fadeOverlapThreshold
    }
  };
}

export function isCompatibleVersion(version: string): boolean {
  const [major, minor] = version.split('.').map(Number);
  const [currentMajor, currentMinor] = CURRENT_VERSION.split('.').map(Number);

  return major === currentMajor && minor <= currentMinor;
}

export function migrateProject(storable: StorableProject): StorableProject {
  return storable;
}

export interface SaveResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  project?: Project;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export async function saveProjectViaIPC(project: Project, defaultPath?: string): Promise<SaveResult> {
  try {
    const serialized = serializeProject(project);
    const result = await window.electronAPI.saveFile(serialized, defaultPath);
    
    if (result.canceled) {
      return { success: false, error: '用户取消了保存' };
    }

    return {
      success: true,
      filePath: result.filePath,
      fileName: result.fileName
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存失败'
    };
  }
}

export async function loadProjectViaIPC(): Promise<LoadResult> {
  try {
    const result = await window.electronAPI.openFile('json');
    
    if (result.canceled || !result.content) {
      return { success: false, error: '用户取消了加载' };
    }

    const project = deserializeProject(result.content);
    
    return {
      success: true,
      project,
      filePath: result.filePath,
      fileName: result.fileName
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '加载失败'
    };
  }
}
