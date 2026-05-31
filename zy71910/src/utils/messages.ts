interface FriendlyMessage {
  title: string;
  message: string;
  suggestion?: string;
}

const messageMap: Record<string, FriendlyMessage> = {
  'file_duplicate': {
    title: '这个文件好像导过了',
    message: '检测到一个一模一样的音轨文件，之前的分段记录还在呢。',
    suggestion: '可以选"新建版本"保留历史，或者直接"覆盖"用新的'
  },
  'file_same_name': {
    title: '发现同名文件',
    message: '库里有个文件名跟这个一样，但内容不太一样哦。',
    suggestion: '建议创建新版本，这样能区分开两次的内容'
  },
  'time_overlap': {
    title: '这两段时间撞车了',
    message: '第 {0} 和第 {1} 个分段的时间重叠了，导出时会有问题。',
    suggestion: '拖动调整一下位置，或者把其中一段标为废弃'
  },
  'time_gap_large': {
    title: '这里好像空了一块',
    message: '第 {0} 和第 {1} 段之间空了 {2} 秒，是故意留白的吗？',
    suggestion: '如果是漏了就补一段，确认没问题的话可以直接忽略'
  },
  'time_gap_small': {
    title: '两段挨得太近了',
    message: '第 {0} 和第 {1} 段之间只隔了 {2} 毫秒，会不会是同一处？',
    suggestion: '可以合并成一段，或者手动调整一下间隔'
  },
  'silence_long': {
    title: '发现一段长静音',
    message: '在 {0} 秒附近有 {1} 秒静音，自动帮你标成待确认了。',
    suggestion: '听一下确认是不是需要保留，没用的话可以删掉'
  },
  'text_empty': {
    title: '这段还没写字幕',
    message: '第 {0} 段的字幕是空的，但时长只有 {1} 秒，会不会漏标了？',
    suggestion: '补上字幕内容，或者确认是语气词/停顿就标为已确认'
  },
  'export_no_confirmed': {
    title: '还没有可导出的内容',
    message: '当前筛选条件下没有"已确认"的分段，导出清单会是空的。',
    suggestion: '先确认一些分段，或者勾选"包含待确认"再试试'
  },
  'import_failed': {
    title: '文件导入失败了',
    message: '这个文件好像读不出来，格式有问题或者文件损坏了？',
    suggestion: '检查一下是不是支持的音频格式，或者换个文件试试'
  },
  'undo_limit': {
    title: '不能再撤回啦',
    message: '已经回到最早的操作记录了，这就是最开始的样子。',
    suggestion: '如果还是不对，可以重新导入文件'
  },
  'segment_not_found': {
    title: '找不到这个分段了',
    message: '想操作的分段好像已经被删掉或者不存在了。',
    suggestion: '刷新一下列表看看最新状态'
  }
};

export function getFriendlyMessage(code: string, ...params: string[]): FriendlyMessage {
  const template = messageMap[code] || {
    title: '遇到点小问题',
    message: '操作没成功，再试一下？',
    suggestion: '如果一直不行可以记下来找技术同学看看'
  };
  
  return {
    title: template.title,
    message: params.reduce((msg, p, i) => msg.replace(`{${i}}`, p), template.message),
    suggestion: template.suggestion
  };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
