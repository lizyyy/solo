const ERROR_TYPES = {
  PITCH_HIGH: 'pitch_high',
  PITCH_LOW: 'pitch_low',
  BEAT_EARLY: 'beat_early',
  BEAT_LATE: 'beat_late',
  TIMING: 'timing',
  OTHER: 'other'
};

const ERROR_TYPE_NAMES = {
  [ERROR_TYPES.PITCH_HIGH]: '音偏高',
  [ERROR_TYPES.PITCH_LOW]: '音偏低',
  [ERROR_TYPES.BEAT_EARLY]: '抢拍',
  [ERROR_TYPES.BEAT_LATE]: '拖拍',
  [ERROR_TYPES.TIMING]: '节奏问题',
  [ERROR_TYPES.OTHER]: '其他'
};

const MARK_TYPES = {
  NONE: 'none',
  FALSE_POSITIVE: 'false_positive',
  NEED_PRACTICE: 'need_practice',
  FIXED: 'fixed'
};

const MARK_TYPE_NAMES = {
  [MARK_TYPES.NONE]: '无标记',
  [MARK_TYPES.FALSE_POSITIVE]: '误检',
  [MARK_TYPES.NEED_PRACTICE]: '需要重点练',
  [MARK_TYPES.FIXED]: '已修正'
};

const REQUIRED_COLUMNS = {
  sessions: ['session_id', 'date', 'location', 'notes'],
  setlist: ['session_id', 'song_id', 'song_name', 'order'],
  takes: ['session_id', 'song_id', 'take_id', 'start_time', 'end_time', 'musician', 'instrument'],
  pitchBeat: ['session_id', 'song_id', 'take_id', 'time', 'pitch_cents', 'beat_ms', 'error_type', 'musician', 'instrument', 'section']
};

const COLUMNS_DESCRIPTION = {
  sessions: {
    session_id: '排练场次唯一标识，如 S001',
    date: '排练日期，格式 YYYY-MM-DD',
    location: '排练地点',
    notes: '排练备注'
  },
  setlist: {
    session_id: '关联的排练场次ID',
    song_id: '歌曲唯一标识',
    song_name: '歌曲名称',
    order: '演出顺序（数字）'
  },
  takes: {
    session_id: '关联的排练场次ID',
    song_id: '关联的歌曲ID',
    take_id: 'Take 唯一标识，如 T001',
    start_time: 'Take 开始时间戳（秒）',
    end_time: 'Take 结束时间戳（秒）',
    musician: '演奏者/演唱者姓名',
    instrument: '乐器或声部，如 vocal, guitar, bass, drums, keyboard'
  },
  pitchBeat: {
    session_id: '关联的排练场次ID',
    song_id: '关联的歌曲ID',
    take_id: '关联的 Take ID',
    time: '时间点（秒，相对于 Take 开始）',
    pitch_cents: '音高偏差（cent，正负值，0为完美）',
    beat_ms: '节拍偏移（毫秒，正为拖拍，负为抢拍）',
    error_type: `错误类型：${Object.values(ERROR_TYPES).join(', ')}`,
    musician: '演奏者/演唱者姓名',
    instrument: '乐器或声部',
    section: '歌曲段落，如 intro, verse, chorus, bridge, outro'
  }
};

const DEFAULT_INSTRUMENTS = ['vocal', 'guitar', 'bass', 'drums', 'keyboard', 'sax', 'trumpet'];
const DEFAULT_SECTIONS = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'solo', 'outro'];

const PITCH_CENTS_THRESHOLD = {
  warning: 20,
  error: 50,
  extreme: 100
};

const BEAT_MS_THRESHOLD = {
  warning: 50,
  error: 100,
  extreme: 200
};

module.exports = {
  ERROR_TYPES,
  ERROR_TYPE_NAMES,
  MARK_TYPES,
  MARK_TYPE_NAMES,
  REQUIRED_COLUMNS,
  COLUMNS_DESCRIPTION,
  DEFAULT_INSTRUMENTS,
  DEFAULT_SECTIONS,
  PITCH_CENTS_THRESHOLD,
  BEAT_MS_THRESHOLD
};
