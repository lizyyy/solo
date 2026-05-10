import db from '../database';
import { MenuVersion, MenuItem, BusinessResponse } from '../types';
import { generateId, now, successResponse, errorResponse, formatBusinessTime } from '../utils/business';

export const menuVersionService = {
  createVersion: (
    version: string,
    description: string,
    itemIds: string[],
    createdBy: string
  ): BusinessResponse => {
    if (!version || version.trim() === '') {
      return errorResponse('ERR-MV-001', '版本号不能为空');
    }
    if (itemIds.length === 0) {
      return errorResponse('ERR-MV-002', '菜单版本至少需要包含一个商品');
    }

    const existing = db.menuVersions.find(v => v.version === version);
    if (existing) {
      return errorResponse('ERR-MV-003', `版本「${version}」已存在`);
    }

    try {
      db.menuVersions.forEach(v => { v.isActive = false; });
      
      const newVersion: MenuVersion = {
        id: generateId('mv'),
        version,
        description,
        itemIds,
        createdBy,
        createdAt: now(),
        isActive: true
      };
      db.addMenuVersion(newVersion);
      
      return successResponse(
        `菜单版本「${version}」创建成功，已设为当前活跃版本`,
        {
          版本号: version,
          商品数量: itemIds.length,
          创建人: createdBy,
          创建时间: formatBusinessTime(now())
        }
      );
    } catch (e: any) {
      return errorResponse('ERR-MV-004', `创建版本失败：${e.message}`);
    }
  },

  getActiveVersion: (): MenuVersion | null => {
    const found = [...db.menuVersions].filter(v => v.isActive).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return found || null;
  },

  getAllVersions: (): MenuVersion[] => {
    return [...db.menuVersions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getVersionItems: (versionId: string): MenuItem[] => {
    const version = db.menuVersions.find(v => v.id === versionId);
    if (!version) return [];
    
    return db.menuItems.filter(item => version.itemIds.includes(item.id));
  },

  activateVersion: (versionId: string, operator: string): BusinessResponse => {
    const version = db.menuVersions.find(v => v.id === versionId);
    if (!version) {
      return errorResponse('ERR-MV-005', '版本不存在');
    }
    if (version.isActive) {
      return errorResponse('WARN-MV-001', `版本「${version.version}」已是当前活跃版本`);
    }

    try {
      db.menuVersions.forEach(v => { v.isActive = false; });
      version.isActive = true;
      db.save();
      
      return successResponse(
        `版本「${version.version}」已切换为当前活跃版本`,
        {
          版本号: version.version,
          商品数量: version.itemIds.length,
          切换人: operator,
          切换时间: formatBusinessTime(now())
        }
      );
    } catch (e: any) {
      return errorResponse('ERR-MV-006', `切换版本失败：${e.message}`);
    }
  }
};

export default menuVersionService;
