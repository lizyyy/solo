import type { ComicPage, Bubble, BubbleVersion, Issue, RevisionLog } from '../types';
import { generateId } from '../utils/helpers';

const PAGE_ID = 'page-test-001';

export const mockComicPage: ComicPage = {
  id: PAGE_ID,
  pageNumber: '001',
  title: '第1页 · 序章',
  imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=manga%20comic%20page%20black%20and%20white%20japanese%20style%20with%20multiple%20panels&image_size=portrait_4_3',
  width: 800,
  height: 1100,
  status: 'PENDING',
  createdAt: '2026-05-28T10:00:00.000Z',
  updatedAt: '2026-05-28T10:00:00.000Z',
};

export const mockConflictScenario = {
  page: mockComicPage,
  firstImport: {
    sequenceNumber: 3,
    text: '你好，我是第一版台词',
    x: 100,
    y: 200,
    width: 150,
    height: 80,
    operator: '编辑A',
    remark: '初稿',
  },
  secondImport: {
    sequenceNumber: 3,
    text: '你好，我是第二版台词，别把我覆盖了',
    x: 120,
    y: 220,
    width: 160,
    height: 90,
    operator: '编辑B',
    remark: '修订版',
  },
  expectedResult: {
    bubbleCount: 1,
    versionCount: 2,
    hasConflict: true,
    status: 'PENDING',
    noSilentOverride: true,
  },
};

export const mockIssueScenario = {
  overlapBubbles: [
    { seq: 1, x: 50, y: 50, width: 120, height: 70, text: '第一个气泡' },
    { seq: 2, x: 80, y: 70, width: 120, height: 70, text: '第二个气泡，重叠了' },
  ],
  spillBubble: {
    seq: 3,
    text: '这是一段非常非常非常非常非常非常长的台词，一定会超出气泡框的容量限制，不信你数数看有多少字',
    x: 200,
    y: 300,
    width: 140,
    height: 60,
  },
  sequenceBubbles: [
    { seq: 4, y: 450, text: '我在下面，但序号在前' },
    { seq: 5, y: 150, text: '我在上面，但序号在后，顺序错了' },
  ],
};

function createMockBubble(seq: number, versionData: Partial<BubbleVersion>): { bubble: Bubble; version: BubbleVersion } {
  const bubbleId = generateId();
  const versionId = generateId();
  const now = new Date().toISOString();

  const bubble: Bubble = {
    id: bubbleId,
    pageId: PAGE_ID,
    sequenceNumber: seq,
    compositeKey: `${PAGE_ID}:${seq}`,
    currentVersionId: versionId,
    latestVersion: 1,
    hasConflict: false,
    status: 'PENDING',
  };

  const version: BubbleVersion = {
    id: versionId,
    bubbleId,
    version: 1,
    text: versionData.text || '',
    x: versionData.x || 0,
    y: versionData.y || 0,
    width: versionData.width || 100,
    height: versionData.height || 60,
    status: 'PENDING',
    operator: versionData.operator || '系统',
    createdAt: now,
    remark: versionData.remark || '',
  };

  return { bubble, version };
}

export function generateFullMockData(): {
  pages: ComicPage[];
  bubbles: Bubble[];
  versions: BubbleVersion[];
  issues: Issue[];
  revisions: RevisionLog[];
} {
  const pages: ComicPage[] = [mockComicPage];
  const bubbles: Bubble[] = [];
  const versions: BubbleVersion[] = [];
  const issues: Issue[] = [];
  const revisions: RevisionLog[] = [];

  const b1 = createMockBubble(1, {
    text: '第一个气泡，正常',
    x: 80,
    y: 80,
    width: 130,
    height: 70,
    operator: '编辑A',
    remark: '没问题',
  });
  bubbles.push(b1.bubble);
  versions.push(b1.version);

  const b2 = createMockBubble(2, {
    text: '第二个气泡，和第一个重叠了',
    x: 110,
    y: 100,
    width: 130,
    height: 70,
    operator: '编辑A',
    remark: '位置需要调整',
  });
  bubbles.push(b2.bubble);
  versions.push(b2.version);

  const b3v1: BubbleVersion = {
    id: generateId(),
    bubbleId: '',
    version: 1,
    text: '你好，我是第一版台词',
    x: 100,
    y: 250,
    width: 150,
    height: 80,
    status: 'HISTORY',
    operator: '编辑A',
    createdAt: '2026-05-28T10:30:00.000Z',
    remark: '初稿，已被新版本替代',
  };

  const b3v2: BubbleVersion = {
    id: generateId(),
    bubbleId: '',
    version: 2,
    text: '你好，我是第二版台词，别把我覆盖了',
    x: 120,
    y: 270,
    width: 160,
    height: 90,
    status: 'PENDING',
    operator: '编辑B',
    createdAt: '2026-05-28T11:00:00.000Z',
    remark: '修订版，等待确认',
  };

  const bubble3: Bubble = {
    id: generateId(),
    pageId: PAGE_ID,
    sequenceNumber: 3,
    compositeKey: `${PAGE_ID}:3`,
    currentVersionId: b3v2.id,
    latestVersion: 2,
    hasConflict: true,
    status: 'PENDING',
  };

  b3v1.bubbleId = bubble3.id;
  b3v2.bubbleId = bubble3.id;

  bubbles.push(bubble3);
  versions.push(b3v1, b3v2);

  revisions.push({
    id: generateId(),
    versionId: b3v1.id,
    fieldName: 'status',
    oldValue: 'PENDING',
    newValue: 'HISTORY',
    operator: 'system',
    operatedAt: '2026-05-28T11:00:00.000Z',
  });

  const b4 = createMockBubble(4, {
    text: '这是一段非常非常非常非常非常非常长的台词，一定会超出气泡框的容量限制，不信你数数看有多少字，确实太长了',
    x: 300,
    y: 250,
    width: 140,
    height: 60,
    operator: '编辑A',
    remark: '台词需要精简',
  });
  bubbles.push(b4.bubble);
  versions.push(b4.version);

  const b5 = createMockBubble(5, {
    text: '我在下面，序号5',
    x: 100,
    y: 500,
    width: 140,
    height: 60,
    operator: '编辑A',
    remark: '',
  });
  bubbles.push(b5.bubble);
  versions.push(b5.version);

  const b6 = createMockBubble(6, {
    text: '我在上面，但序号6，阅读顺序可能错误',
    x: 100,
    y: 400,
    width: 140,
    height: 60,
    operator: '编辑A',
    remark: '顺序需要调整',
  });
  bubbles.push(b6.bubble);
  versions.push(b6.version);

  const overlapArea = (130 + 130 - (110 - 80 + 130)) * (70 + 70 - (100 - 80 + 70));
  const minArea = Math.min(130 * 70, 130 * 70);
  issues.push({
    id: generateId(),
    bubbleId: b1.bubble.id,
    relatedBubbleId: b2.bubble.id,
    type: 'OVERLAP',
    description: `气泡 1 与 2 重叠，重叠面积占比 ${(Math.abs(overlapArea) / minArea * 100).toFixed(1)}%`,
    severity: 'ERROR',
    status: 'OPEN',
    detectedAt: '2026-05-28T11:05:00.000Z',
    detectedBy: 'engine-v1.0',
  });

  const spillCharCount = b4.version.text.length;
  const spillCapacity = Math.floor((140 - 16) / 16) * Math.floor((60 - 16) / (16 * 1.4));
  issues.push({
    id: generateId(),
    bubbleId: b4.bubble.id,
    type: 'SPILL',
    description: `台词过长，当前 ${spillCharCount} 字，估计容量 ${spillCapacity} 字，超出 ${spillCharCount - spillCapacity} 字`,
    severity: 'WARNING',
    status: 'OPEN',
    detectedAt: '2026-05-28T11:05:00.000Z',
    detectedBy: 'engine-v1.0',
  });

  issues.push({
    id: generateId(),
    bubbleId: b6.bubble.id,
    type: 'SEQUENCE',
    description: '阅读顺序可能错误，气泡 6 位置在气泡 5 上方',
    severity: 'WARNING',
    status: 'OPEN',
    detectedAt: '2026-05-28T11:05:00.000Z',
    detectedBy: 'engine-v1.0',
  });

  return { pages, bubbles, versions, issues, revisions };
}

export function initMockData(): void {
  const data = generateFullMockData();
  localStorage.setItem('comic-bubble-checker:pages', JSON.stringify(data.pages));
  localStorage.setItem('comic-bubble-checker:bubbles', JSON.stringify(data.bubbles));
  localStorage.setItem('comic-bubble-checker:versions', JSON.stringify(data.versions));
  localStorage.setItem('comic-bubble-checker:issues', JSON.stringify(data.issues));
  localStorage.setItem('comic-bubble-checker:revisions', JSON.stringify(data.revisions));
}
