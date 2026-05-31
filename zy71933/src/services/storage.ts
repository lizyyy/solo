import { Material, MaterialStatus, VersionHistory, ChangeRecord, AuthorizationFile, User, FilterOptions } from '../types';

const STORAGE_KEY = 'brand_material_review';
const USER_KEY = 'current_user';

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const getCurrentUser = (): User => {
  const stored = localStorage.getItem(USER_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  const defaultUser: User = { id: generateId(), name: '当前用户' };
  localStorage.setItem(USER_KEY, JSON.stringify(defaultUser));
  return defaultUser;
};

export const setCurrentUser = (name: string): void => {
  const user = getCurrentUser();
  user.name = name;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getAllMaterials = (): Material[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveMaterials = (materials: Material[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
};

export const getMaterialById = (id: string): Material | undefined => {
  const materials = getAllMaterials();
  return materials.find(m => m.id === id);
};

const createVersionHistory = (
  version: number,
  modifiedBy: string,
  changes: ChangeRecord[],
  comment: string,
  status: MaterialStatus
): VersionHistory => ({
  version,
  timestamp: new Date().toISOString(),
  modifiedBy,
  changes,
  comment,
  status
});

export const createMaterial = (
  data: Omit<Material, 'id' | 'createdAt' | 'lastModifiedAt' | 'currentVersion' | 'versionHistory'>
): Material => {
  const user = getCurrentUser();
  const now = new Date().toISOString();
  const id = generateId();
  
  const initialVersion = createVersionHistory(
    1,
    user.name,
    [{ field: '物料创建', oldValue: '', newValue: '初始版本' }],
    '物料首次录入',
    data.currentStatus
  );

  const material: Material = {
    ...data,
    id,
    createdAt: now,
    lastModifiedAt: now,
    currentVersion: 1,
    versionHistory: [initialVersion]
  };

  const materials = getAllMaterials();
  materials.push(material);
  saveMaterials(materials);
  
  return material;
};

export const updateMaterialStatus = (
  id: string,
  newStatus: MaterialStatus,
  reason: string,
  comment: string
): Material | undefined => {
  const materials = getAllMaterials();
  const index = materials.findIndex(m => m.id === id);
  
  if (index === -1) return undefined;
  
  const user = getCurrentUser();
  const material = materials[index];
  const now = new Date().toISOString();
  
  const changes: ChangeRecord[] = [
    { field: '状态', oldValue: material.currentStatus, newValue: newStatus },
    { field: '状态原因', oldValue: material.statusReason, newValue: reason }
  ];

  const newVersion = createVersionHistory(
    material.currentVersion + 1,
    user.name,
    changes,
    comment,
    newStatus
  );

  materials[index] = {
    ...material,
    currentStatus: newStatus,
    statusReason: reason,
    lastModifiedAt: now,
    lastModifiedBy: user.name,
    currentVersion: material.currentVersion + 1,
    versionHistory: [...material.versionHistory, newVersion]
  };

  saveMaterials(materials);
  return materials[index];
};

export const detectChanges = (oldAuth: AuthorizationFile | undefined, newAuth: AuthorizationFile): ChangeRecord[] => {
  const changes: ChangeRecord[] = [];
  
  if (!oldAuth) {
    changes.push({ field: '授权文件', oldValue: '无', newValue: newAuth.name });
    return changes;
  }

  if (oldAuth.name !== newAuth.name) {
    changes.push({ field: '文件名', oldValue: oldAuth.name, newValue: newAuth.name });
  }
  if (oldAuth.expiryDate !== newAuth.expiryDate) {
    changes.push({ field: '授权到期日', oldValue: oldAuth.expiryDate, newValue: newAuth.expiryDate });
  }
  if (oldAuth.fileHash !== newAuth.fileHash) {
    changes.push({ field: '文件内容', oldValue: '已变更', newValue: '已变更' });
  }

  return changes;
};

export const addAuthorizationFile = (
  materialId: string,
  authFile: Omit<AuthorizationFile, 'id' | 'uploadDate' | 'uploadedBy'>
): Material | undefined => {
  const materials = getAllMaterials();
  const index = materials.findIndex(m => m.id === materialId);
  
  if (index === -1) return undefined;
  
  const user = getCurrentUser();
  const material = materials[index];
  const now = new Date().toISOString();

  const existingFile = material.authorizationFiles.find(f => f.name === authFile.name);
  const newFile: AuthorizationFile = {
    ...authFile,
    id: generateId(),
    uploadDate: now,
    uploadedBy: user.name
  };

  const changes = detectChanges(existingFile, newFile);
  
  let updatedAuthFiles = material.authorizationFiles;
  if (existingFile) {
    updatedAuthFiles = material.authorizationFiles.map(f => 
      f.name === authFile.name ? newFile : f
    );
  } else {
    updatedAuthFiles = [...material.authorizationFiles, newFile];
  }

  const newVersion = createVersionHistory(
    material.currentVersion + 1,
    user.name,
    changes.length > 0 ? changes : [{ field: '授权文件', oldValue: '无变更', newValue: '重新上传' }],
    existingFile ? '更新授权文件' : '新增授权文件',
    material.currentStatus
  );

  materials[index] = {
    ...material,
    authorizationFiles: updatedAuthFiles,
    lastModifiedAt: now,
    lastModifiedBy: user.name,
    currentVersion: material.currentVersion + 1,
    versionHistory: [...material.versionHistory, newVersion]
  };

  saveMaterials(materials);
  return materials[index];
};

export const filterMaterials = (options: FilterOptions): Material[] => {
  let materials = getAllMaterials();

  if (options.status) {
    materials = materials.filter(m => m.currentStatus === options.status);
  }

  if (options.batchId) {
    materials = materials.filter(m => m.batchId === options.batchId);
  }

  if (options.source) {
    materials = materials.filter(m => m.source.includes(options.source!));
  }

  if (options.hasAuthExpired !== undefined) {
    const now = new Date();
    materials = materials.filter(m => {
      const hasExpired = m.authorizationFiles.some(f => new Date(f.expiryDate) < now);
      return options.hasAuthExpired ? hasExpired : !hasExpired;
    });
  }

  return materials;
};

export const getBatchMaterials = (batchId: string): Material[] => {
  const materials = getAllMaterials();
  return materials.filter(m => m.batchId === batchId);
};

export const checkAuthExpiry = (material: Material): boolean => {
  const now = new Date();
  return material.authorizationFiles.some(f => new Date(f.expiryDate) < now);
};

export const getExpiringMaterials = (days: number = 7): Material[] => {
  const materials = getAllMaterials();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  const now = new Date();

  return materials.filter(m => 
    m.authorizationFiles.some(f => {
      const expiry = new Date(f.expiryDate);
      return expiry >= now && expiry <= threshold;
    })
  );
};
