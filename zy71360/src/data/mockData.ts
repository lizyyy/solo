import type { User, Shot, AuditLog, ExportReport } from '@/types';
import { generateId, getInitialVersion } from '@/utils/version';

export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: '张导',
    role: 'director',
    avatar: '🎬',
  },
  {
    id: 'user-2',
    name: '李分镜',
    role: 'storyboard-artist',
    avatar: '✏️',
  },
  {
    id: 'user-3',
    name: '王美术',
    role: 'art-director',
    avatar: '🎨',
  },
  {
    id: 'user-4',
    name: '刘后期',
    role: 'viewer',
    avatar: '👁️',
  },
];

export const mockCurrentUser: User = mockUsers[0];

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

const getUserName = (userId: string) => {
  const user = mockUsers.find((u) => u.id === userId);
  return user?.name || '未知用户';
};

const getUserRole = (userId: string) => {
  const user = mockUsers.find((u) => u.id === userId);
  return user?.role || 'viewer';
};

export function createMockShots(): Shot[] {
  const shot1Id = generateId();
  const shot1v1Id = generateId();
  const shot1v2Id = generateId();
  const shot1v3Id = generateId();

  const shot2Id = generateId();
  const shot2v1Id = generateId();
  const shot2v2Id = generateId();

  const shot3Id = generateId();
  const shot3v1Id = generateId();

  const shot4Id = generateId();
  const shot4v1Id = generateId();
  const shot4v2Id = generateId();

  return [
    {
      id: shot1Id,
      shotNumber: 'S01-E001',
      scene: 'S01',
      sequence: 1,
      currentVersionId: shot1v3Id,
      status: 'locked',
      lockedBy: 'user-1',
      lockedAt: hoursAgo(2),
      createdAt: daysAgo(7),
      updatedAt: hoursAgo(2),
      versions: [
        {
          id: shot1v1Id,
          shotId: shot1Id,
          version: '1.0',
          majorVersion: 1,
          minorVersion: 0,
          title: '开场 - 城市清晨',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20storyboard%20city%20morning%20scene%20sunrise%20skyscraper&image_size=landscape_16_9',
          duration: 5.5,
          dialogue: '（旁白）新的一天开始了...',
          actionDescription: '太阳从城市天际线缓缓升起，镜头缓慢推进。',
          artNotes: '暖色调，金黄色的阳光，薄雾效果。',
          vfxNotes: '需要添加体积光效果，晨雾粒子。',
          referenceLinks: '参考图1: 清晨城市\n参考图2: 体积光效果',
          createdBy: 'user-2',
          createdAt: daysAgo(7),
          changeSummary: '初始版本创建',
          fieldChanges: [],
        },
        {
          id: shot1v2Id,
          shotId: shot1Id,
          version: '1.1',
          majorVersion: 1,
          minorVersion: 1,
          title: '开场 - 城市清晨',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20storyboard%20city%20morning%20scene%20sunrise%20skyscraper&image_size=landscape_16_9',
          duration: 6.0,
          dialogue: '（旁白）城市还在沉睡，新的一天即将开始...',
          actionDescription: '太阳从城市天际线缓缓升起，镜头缓慢推进，掠过屋顶。',
          artNotes: '暖色调，金黄色的阳光，薄雾效果。使用较软的阴影。',
          vfxNotes: '需要添加体积光效果，晨雾粒子。',
          referenceLinks: '参考图1: 清晨城市\n参考图2: 体积光效果',
          createdBy: 'user-2',
          createdAt: daysAgo(5),
          changeSummary: '调整台词和时长',
          fieldChanges: [
            {
              id: generateId(),
              versionId: shot1v2Id,
              fieldName: 'duration',
              oldValue: '5.5',
              newValue: '6.0',
              diff: '[{"value":"5","removed":true},{"value":"6","added":true},{"value":".5","removed":true},{"value":".0","added":true}]',
              reason: '导演要求延长0.5秒',
              modifiedBy: 'user-2',
              modifiedAt: daysAgo(5),
            },
            {
              id: generateId(),
              versionId: shot1v2Id,
              fieldName: 'dialogue',
              oldValue: '（旁白）新的一天开始了...',
              newValue: '（旁白）城市还在沉睡，新的一天即将开始...',
              diff: '[{"value":"（旁白）","unchanged":true},{"value":"新的一天开始了...","removed":true},{"value":"城市还在沉睡，新的一天即将开始...","added":true}]',
              reason: '导演意见：增加叙事感',
              modifiedBy: 'user-2',
              modifiedAt: daysAgo(5),
            },
            {
              id: generateId(),
              versionId: shot1v2Id,
              fieldName: 'artNotes',
              oldValue: '暖色调，金黄色的阳光，薄雾效果。',
              newValue: '暖色调，金黄色的阳光，薄雾效果。使用较软的阴影。',
              diff: '[{"value":"暖色调，金黄色的阳光，薄雾效果。","unchanged":true},{"value":"使用较软的阴影。","added":true}]',
              reason: '美术指导补充',
              modifiedBy: 'user-3',
              modifiedAt: daysAgo(4),
            },
          ],
        },
        {
          id: shot1v3Id,
          shotId: shot1Id,
          version: '2.0',
          majorVersion: 2,
          minorVersion: 0,
          title: '开场 - 城市清晨',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20storyboard%20city%20morning%20scene%20sunrise%20skyscraper&image_size=landscape_16_9',
          duration: 6.0,
          dialogue: '（旁白）城市还在沉睡，新的一天即将开始...',
          actionDescription: '太阳从城市天际线缓缓升起，镜头缓慢推进，掠过屋顶。',
          artNotes: '暖色调，金黄色的阳光，薄雾效果。使用较软的阴影。',
          vfxNotes: '需要添加体积光效果，晨雾粒子。',
          referenceLinks: '参考图1: 清晨城市\n参考图2: 体积光效果',
          createdBy: 'user-1',
          createdAt: hoursAgo(2),
          changeSummary: '导演审定锁定',
          fieldChanges: [],
        },
      ],
    },
    {
      id: shot2Id,
      shotNumber: 'S01-E002',
      scene: 'S01',
      sequence: 2,
      currentVersionId: shot2v2Id,
      status: 'draft',
      createdAt: daysAgo(6),
      updatedAt: hoursAgo(12),
      versions: [
        {
          id: shot2v1Id,
          shotId: shot2Id,
          version: '1.0',
          majorVersion: 1,
          minorVersion: 0,
          title: '主角登场',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20storyboard%20main%20character%20waking%20up%20bedroom%20morning%20light&image_size=landscape_16_9',
          duration: 4.0,
          dialogue: '主角：嗯...又是新的一天。',
          actionDescription: '主角从床上坐起来，伸懒腰，看向窗外。',
          artNotes: '温馨的卧室色调，晨光从窗帘缝隙照入。',
          vfxNotes: '窗帘透光效果，灰尘微粒在光束中漂浮。',
          referenceLinks: '',
          createdBy: 'user-2',
          createdAt: daysAgo(6),
          changeSummary: '初始版本创建',
          fieldChanges: [],
        },
        {
          id: shot2v2Id,
          shotId: shot2Id,
          version: '1.1',
          majorVersion: 1,
          minorVersion: 1,
          title: '主角登场 - 闹钟特写',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20storyboard%20alarm%20clock%20close%20up%20morning%20light&image_size=landscape_16_9',
          duration: 3.5,
          dialogue: '（闹钟铃声）叮铃铃铃！\n主角：（睡意朦胧）再五分钟...',
          actionDescription: '特写闹钟显示7:30，铃声响起，主角手从被子里伸出按掉闹钟。',
          artNotes: '冷蓝色调，显示清晨的困倦感。',
          vfxNotes: '闹钟震动效果，铃声可视化波纹。',
          referenceLinks: '',
          createdBy: 'user-2',
          createdAt: hoursAgo(12),
          changeSummary: '调整为闹钟特写',
          fieldChanges: [
            {
              id: generateId(),
              versionId: shot2v2Id,
              fieldName: 'title',
              oldValue: '主角登场',
              newValue: '主角登场 - 闹钟特写',
              diff: '[{"value":"主角登场","unchanged":true},{"value":" - 闹钟特写","added":true}]',
              reason: '分镜师建议：增加细节',
              modifiedBy: 'user-2',
              modifiedAt: hoursAgo(12),
            },
            {
              id: generateId(),
              versionId: shot2v2Id,
              fieldName: 'duration',
              oldValue: '4.0',
              newValue: '3.5',
              diff: '[{"value":"4","removed":true},{"value":"3","added":true},{"value":".0","unchanged":true}]',
              reason: '节奏调整',
              modifiedBy: 'user-2',
              modifiedAt: hoursAgo(12),
            },
            {
              id: generateId(),
              versionId: shot2v2Id,
              fieldName: 'dialogue',
              oldValue: '主角：嗯...又是新的一天。',
              newValue: '（闹钟铃声）叮铃铃铃！\n主角：（睡意朦胧）再五分钟...',
              diff: '[{"value":"主角：嗯...又是新的一天。","removed":true},{"value":"（闹钟铃声）叮铃铃铃！\\n主角：（睡意朦胧）再五分钟...","added":true}]',
              reason: '增加闹钟音效和角色睡意的表达',
              modifiedBy: 'user-2',
              modifiedAt: hoursAgo(12),
            },
          ],
        },
      ],
    },
    {
      id: shot3Id,
      shotNumber: 'S01-E003',
      scene: 'S01',
      sequence: 3,
      currentVersionId: shot3v1Id,
      status: 'review',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      versions: [
        {
          id: shot3v1Id,
          shotId: shot3Id,
          version: '1.0',
          majorVersion: 1,
          minorVersion: 0,
          title: '街角相遇',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20storyboard%20street%20corner%20meeting%20two%20characters%20city%20background&image_size=landscape_16_9',
          duration: 8.0,
          dialogue: '女主：早上好！\n男主：早，今天也要加油。',
          actionDescription: '男主在街角等待，女主跑过来打招呼，两人并肩前行。',
          artNotes: '明亮的日间色调，街道有生活气息。',
          vfxNotes: '路人剪影，背景虚化。',
          referenceLinks: '',
          createdBy: 'user-2',
          createdAt: daysAgo(3),
          changeSummary: '初始版本创建，提交审核',
          fieldChanges: [],
        },
      ],
    },
    {
      id: shot4Id,
      shotNumber: 'S01-E004',
      scene: 'S01',
      sequence: 4,
      currentVersionId: shot4v2Id,
      status: 'draft',
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(6),
      versions: [
        {
          id: shot4v1Id,
          shotId: shot4Id,
          version: '1.0',
          majorVersion: 1,
          minorVersion: 0,
          title: '校园大门',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20school%20gate%20students%20entering%20morning%20cherry%20blossom&image_size=landscape_16_9',
          duration: 5.0,
          dialogue: '（环境音）学生们的喧闹声',
          actionDescription: '校门特写，学生们陆续走进学校，樱花飘落。',
          artNotes: '春天的感觉，樱花花瓣飞舞，明亮的阳光。',
          vfxNotes: '樱花花瓣飘落动画，人群模糊效果。',
          referenceLinks: '',
          createdBy: 'user-2',
          createdAt: daysAgo(2),
          changeSummary: '初始版本创建',
          fieldChanges: [],
        },
        {
          id: shot4v2Id,
          shotId: shot4Id,
          version: '2.0',
          majorVersion: 2,
          minorVersion: 0,
          title: '校园大门（回滚版）',
          storyboardImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=anime%20school%20gate%20students%20entering%20morning%20cherry%20blossom&image_size=landscape_16_9',
          duration: 5.0,
          dialogue: '（环境音）学生们的喧闹声',
          actionDescription: '校门特写，学生们陆续走进学校，樱花飘落。',
          artNotes: '春天的感觉，樱花花瓣飞舞，明亮的阳光。',
          vfxNotes: '樱花花瓣飘落动画，人群模糊效果。',
          referenceLinks: '',
          createdBy: 'user-1',
          createdAt: hoursAgo(6),
          rollbackFromVersionId: shot4v1Id,
          rollbackReason: 'v1.1的改动不合适，回滚到初始版本',
          changeSummary: '从v1.0回滚',
          fieldChanges: [],
        },
      ],
    },
  ];
}

export function createMockAuditLogs(shots: Shot[]): AuditLog[] {
  const logs: AuditLog[] = [];

  for (const shot of shots) {
    for (const version of shot.versions) {
      if (version.fieldChanges.length === 0 && version.version === '1.0') {
        logs.push({
          id: generateId(),
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          versionId: version.id,
          action: 'create',
          userId: version.createdBy,
          userName: getUserName(version.createdBy),
          userRole: getUserRole(version.createdBy),
          message: `创建镜头 ${shot.shotNumber}`,
          timestamp: version.createdAt,
          details: { version: version.version },
          reason: '创建新镜头',
          versionTo: version.version,
        });
      } else if (version.rollbackFromVersionId) {
        const fromVersion = shot.versions.find((v) => v.id === version.rollbackFromVersionId);
        logs.push({
          id: generateId(),
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          versionId: version.id,
          action: 'rollback',
          userId: version.createdBy,
          userName: getUserName(version.createdBy),
          userRole: getUserRole(version.createdBy),
          message: `回滚 ${shot.shotNumber} 到 v${fromVersion?.version || '历史版本'}`,
          timestamp: version.createdAt,
          details: {
            fromVersionId: version.rollbackFromVersionId,
            fromVersion: fromVersion?.version,
            toVersion: version.version,
          },
          reason: version.rollbackReason || '回滚到历史版本',
          versionFrom: fromVersion?.version,
          versionTo: version.version,
          fieldChanges: 0,
          isRollback: true,
        });
      } else if (version.fieldChanges.length > 0) {
        const prevVersion = shot.versions.find((v) => v.version === '1.0');
        logs.push({
          id: generateId(),
          shotId: shot.id,
          shotNumber: shot.shotNumber,
          versionId: version.id,
          action: 'edit',
          userId: version.createdBy,
          userName: getUserName(version.createdBy),
          userRole: getUserRole(version.createdBy),
          message: `更新 ${shot.shotNumber} 的 ${version.fieldChanges.length} 个字段`,
          timestamp: version.createdAt,
          details: {
            version: version.version,
            changedFields: version.fieldChanges.map((f) => f.fieldName),
          },
          reason: version.changeSummary,
          versionFrom: prevVersion?.version,
          versionTo: version.version,
          fieldChanges: version.fieldChanges.length,
        });
      }
    }

    if (shot.status === 'locked' && shot.lockedAt && shot.lockedBy) {
      const currentV = shot.versions.find((v) => v.id === shot.currentVersionId);
      logs.push({
        id: generateId(),
        shotId: shot.id,
        shotNumber: shot.shotNumber,
        action: 'lock',
        userId: shot.lockedBy,
        userName: getUserName(shot.lockedBy),
        userRole: getUserRole(shot.lockedBy),
        message: `锁定 ${shot.shotNumber} 版本 v${currentV?.version}`,
        timestamp: shot.lockedAt,
        details: { version: currentV?.version },
        reason: '导演审定通过，锁定版本',
        versionTo: currentV?.version,
      });
    }
  }

  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export const mockExportReports: ExportReport[] = [];
