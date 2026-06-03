import { TestCase, TestCaseType, Waypoint, ExhibitData } from '@/types';

function createNormalExhibits(): ExhibitData[] {
  return [
    { exhibitId: 'EXH-001', name: '青铜器展柜', x: 10, y: 8, pointCloudRadius: 2.0, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-002', name: '陶瓷展柜', x: 20, y: 12, pointCloudRadius: 1.8, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-003', name: '书画展柜', x: 30, y: 10, pointCloudRadius: 2.5, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-004', name: '玉器展柜', x: 25, y: 20, pointCloudRadius: 1.8, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-005', name: '钱币展柜', x: 15, y: 18, pointCloudRadius: 2.0, radiusSource: 'point_cloud' },
  ];
}

function createWrongCaliberExhibits(): ExhibitData[] {
  return [
    { exhibitId: 'EXH-001', name: '青铜器展柜', x: 10, y: 8, pointCloudRadius: 1.5, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-002', name: '陶瓷展柜', x: 20, y: 12, pointCloudRadius: 1.5, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-003', name: '书画展柜', x: 30, y: 10, pointCloudRadius: 1.5, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-004', name: '玉器展柜', x: 25, y: 20, pointCloudRadius: 1.5, radiusSource: 'point_cloud' },
    { exhibitId: 'EXH-005', name: '钱币展柜', x: 15, y: 18, pointCloudRadius: 1.5, radiusSource: 'point_cloud' },
  ];
}

function createNormalRoute(): Waypoint[] {
  return [
    { x: 5, y: 5 },
    { x: 10, y: 8 },
    { x: 20, y: 12 },
    { x: 30, y: 10 },
    { x: 25, y: 20 },
    { x: 15, y: 18 },
    { x: 5, y: 25 },
  ];
}

function createSupplementaryRoute(): Waypoint[] {
  return [
    { x: 5, y: 25 },
    { x: 8, y: 28 },
    { x: 15, y: 30 },
    { x: 22, y: 28 },
    { x: 28, y: 25 },
  ];
}

export const testCases: Record<TestCaseType, TestCase> = {
  normal: {
    id: 'test-normal',
    type: 'normal',
    name: '正常材料',
    description: '点云抽稀日志与安全半径表数据完全一致，无冲突，可直接导出',
    pointCloudData: {
      filename: '点云抽稀日志_正常.txt',
      operator: '航测内业小魏',
      exhibits: createNormalExhibits(),
      route: createNormalRoute(),
      rawContent: '[展柜数据]\nEXH-001,青铜器展柜,10,8,2.0\nEXH-002,陶瓷展柜,20,12,1.8\nEXH-003,书画展柜,30,10,2.5\nEXH-004,玉器展柜,25,20,1.8\nEXH-005,钱币展柜,15,18,2.0\n\n[动线数据]\n5,5\n10,8\n20,12\n30,10\n25,20\n15,18\n5,25\n',
    },
    safetyRadiusData: {
      filename: '安全半径表_正常.csv',
      version: 'v1.0',
      operator: '航测内业小魏',
      exhibits: [
        { exhibitId: 'EXH-001', safetyRadius: 2.0 },
        { exhibitId: 'EXH-002', safetyRadius: 1.8 },
        { exhibitId: 'EXH-003', safetyRadius: 2.5 },
        { exhibitId: 'EXH-004', safetyRadius: 1.8 },
        { exhibitId: 'EXH-005', safetyRadius: 2.0 },
      ],
      rawContent: 'exhibitId,safetyRadius\nEXH-001,2.0\nEXH-002,1.8\nEXH-003,2.5\nEXH-004,1.8\nEXH-005,2.0\n',
    },
    expectedConflicts: 0,
    expectedPendingReviews: 0,
  },

  wrong_caliber: {
    id: 'test-wrong-caliber',
    type: 'wrong_caliber',
    name: '错口径材料',
    description: '点云抽稀日志使用的半径与安全半径表不一致，存在多处冲突，需要人工裁决',
    pointCloudData: {
      filename: '点云抽稀日志_错口径.txt',
      operator: '航测内业小魏',
      exhibits: createWrongCaliberExhibits(),
      route: createNormalRoute(),
      rawContent: '[展柜数据]\nEXH-001,青铜器展柜,10,8,1.5\nEXH-002,陶瓷展柜,20,12,1.5\nEXH-003,书画展柜,30,10,1.5\nEXH-004,玉器展柜,25,20,1.5\nEXH-005,钱币展柜,15,18,1.5\n\n[动线数据]\n5,5\n10,8\n20,12\n30,10\n25,20\n15,18\n5,25\n',
    },
    safetyRadiusData: {
      filename: '安全半径表_错口径.csv',
      version: 'v1.1',
      operator: '航测内业小魏',
      exhibits: [
        { exhibitId: 'EXH-001', safetyRadius: 2.0 },
        { exhibitId: 'EXH-002', safetyRadius: 1.8 },
        { exhibitId: 'EXH-003', safetyRadius: 2.5 },
        { exhibitId: 'EXH-004', safetyRadius: 1.8 },
        { exhibitId: 'EXH-005', safetyRadius: 2.0 },
      ],
      rawContent: 'version:1.1\nexhibitId,safetyRadius\nEXH-001,2.0\nEXH-002,1.8\nEXH-003,2.5\nEXH-004,1.8\nEXH-005,2.0\n',
    },
    expectedConflicts: 5,
    expectedPendingReviews: 0,
  },

  supplementary: {
    id: 'test-supplementary',
    type: 'supplementary',
    name: '补录材料',
    description: '存在补录路线，且上报长度与计算长度不一致，需要客户复核',
    pointCloudData: {
      filename: '点云抽稀日志_补录.txt',
      operator: '航测内业小魏',
      exhibits: createNormalExhibits(),
      route: createNormalRoute(),
      rawContent: '[展柜数据]\nEXH-001,青铜器展柜,10,8,2.0\nEXH-002,陶瓷展柜,20,12,1.8\nEXH-003,书画展柜,30,10,2.5\nEXH-004,玉器展柜,25,20,1.8\nEXH-005,钱币展柜,15,18,2.0\n\n[动线数据]\n5,5\n10,8\n20,12\n30,10\n25,20\n15,18\n5,25\n',
    },
    safetyRadiusData: {
      filename: '安全半径表_补录.csv',
      version: 'v1.2',
      operator: '航测内业小魏',
      exhibits: [
        { exhibitId: 'EXH-001', safetyRadius: 2.0 },
        { exhibitId: 'EXH-002', safetyRadius: 1.8 },
        { exhibitId: 'EXH-003', safetyRadius: 2.5 },
        { exhibitId: 'EXH-004', safetyRadius: 1.8 },
        { exhibitId: 'EXH-005', safetyRadius: 2.0 },
      ],
      rawContent: 'version:1.2\nexhibitId,safetyRadius\nEXH-001,2.0\nEXH-002,1.8\nEXH-003,2.5\nEXH-004,1.8\nEXH-005,2.0\n',
    },
    supplementaryRoute: {
      waypoints: createSupplementaryRoute(),
      reportedLength: 35.0,
      isSupplementary: true,
      lengthRecalculated: false,
      reviewStatus: 'pending',
    },
    expectedConflicts: 0,
    expectedPendingReviews: 1,
  },
};

export function getTestCaseFileBlob(
  testCase: TestCase,
  type: 'point_cloud' | 'safety_radius'
): Blob {
  if (type === 'point_cloud') {
    return new Blob([testCase.pointCloudData.rawContent], {
      type: 'text/plain',
    });
  } else if (type === 'safety_radius' && testCase.safetyRadiusData) {
    return new Blob([testCase.safetyRadiusData.rawContent], {
      type: testCase.safetyRadiusData.filename.endsWith('.csv')
        ? 'text/csv'
        : 'text/plain',
    });
  }
  return new Blob();
}

export function createFileFromBlob(
  blob: Blob,
  filename: string
): File {
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now(),
  });
}
