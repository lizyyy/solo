'use strict';

const DIRS = {
  RAW_PHOTOS: 'raw_photos',
  ARCHIVED: 'archived',
  PENDING: 'pending',
  DATA: '.inspection',
  REPORTS: 'reports'
};

const FILES = {
  CONFIG: 'config.json',
  POINTS: 'points.json',
  RECORDS: 'records.json',
  PHOTOS: 'photos.json',
  HISTORY: 'history.json',
  INDEX: 'index.json'
};

const PHOTO_STATUS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  NO_EXIF: 'no_exif',
  NO_POINT: 'no_point',
  DUPLICATE: 'duplicate',
  CONFLICT: 'conflict',
  ARCHIVED: 'archived',
  NEEDS_MANUAL: 'needs_manual'
};

const PROBLEM_TYPES = [
  '裂缝',
  '空鼓',
  '漏水',
  '钢筋外露',
  '模板偏差',
  '平整度差',
  '安全隐患',
  '其他'
];

const NAMING_PATTERN = '{{project}}_{{floor}}_{{point}}_{{time}}_{{type}}{{suffix}}.{{ext}}';

module.exports = { DIRS, FILES, PHOTO_STATUS, PROBLEM_TYPES, NAMING_PATTERN };
