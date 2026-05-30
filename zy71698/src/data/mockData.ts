import type { MaterialType } from '@/types';

export const MOCK_FILES: Record<MaterialType, { name: string; content: string }> = {
  timeline: {
    name: '导演剪辑版_时间轴_v3.txt',
    content: `Cue号\t入点\t出点\t名称
1\t00:00:00:00\t00:01:30:12\t开场序幕
2\t00:01:30:12\t00:03:15:08\t主题呈现
3\t00:03:15:08\t00:05:42:20\t追逐场景
4\t00:05:42:20\t00:07:18:15\t情感转折
5\t00:07:18:15\t00:09:30:00\t高潮对决
6\t00:09:30:00\t00:10:45:22\t结尾淡出`,
  },
  dialog: {
    name: '对白轨_最终版.txt',
    content: `编号\t开始时间\t结束时间\t内容
1\t00:00:30:00\t00:00:35:00\t"这是一个寂静的夜晚"
2\t00:01:45:12\t00:01:50:00\t"准备好了吗？"
3\t00:03:20:05\t00:03:25:10\t"快！他们追上来了！"
4\t00:05:50:00\t00:05:55:00\t"为什么会变成这样..."
5\t00:07:30:00\t00:07:35:15\t"结束了，一切都结束了"
6\t00:09:45:00\t00:09:50:00\t"谢谢你"`,
  },
  music: {
    name: '配乐清单_20240115_02m30s.txt',
    content: `Cue No.\tTitle\tStart Time\tEnd Time\tDuration
C1\tOpening Theme\t00:00:00\t00:01:32\t1:32
C2\tMain Theme\t00:01:30\t00:03:18\t1:48
C3\tChase Scene\t00:03:15\t00:05:45\t2:30
C4\tEmotional\t00:05:42\t00:07:20\t1:38
C5\tClimax\t00:07:18\t00:09:32\t2:14
C6\tEnding\t00:09:30\t00:10:48\t1:18`,
  },
  cue: {
    name: 'Cue清单_音乐部门_20240115.csv',
    content: `Cue号,名称,开始时间,结束时间,时长,备注
1,Opening,00:00:00:00,00:01:30:12,00:01:30:12,钢琴为主
2,Main Title,00:01:30:12,00:03:15:08,00:01:44:20,管弦乐
3,The Chase,00:03:15:08,00:05:42:20,00:02:27:12,电子+打击乐
4,Betrayal,00:05:42:20,00:07:18:15,00:01:35:23,弦乐
5,Final Battle,00:07:18:15,00:09:30:00,00:02:11:10,全编制
6,Epilogue,00:09:30:00,00:10:45:22,00:01:15:22,钢琴+小提琴`,
  },
  note: {
    name: '导演备注_20240116.txt',
    content: `00:00:00 开场音乐需要更有压迫感
00:01:30 主题出现时音量推起来
00:03:15 追逐戏节奏要快，鼓点要重
00:05:42 这里情绪转折很重要，音乐要淡下来
00:07:18 高潮部分不要盖过对白
00:09:30 结尾拉长一点，留有余韵

整体风格参考《银翼杀手2049》
注意第3分钟处有音效设计，音乐要让着点`,
  },
};

export function getMockContent(type: MaterialType): { name: string; content: string } {
  return MOCK_FILES[type];
}

export function generateMockProject(): {
  projectName: string;
  projectDescription: string;
  materials: Array<{ type: MaterialType; name: string; content: string }>;
} {
  return {
    projectName: '《星际迷途》配乐核对',
    projectDescription: '科幻电影《星际迷途》导演剪辑版配乐Cue点核对，包含开场、主题、追逐、情感、高潮、结尾六个段落。',
    materials: [
      { type: 'timeline', ...MOCK_FILES.timeline },
      { type: 'dialog', ...MOCK_FILES.dialog },
      { type: 'music', ...MOCK_FILES.music },
      { type: 'cue', ...MOCK_FILES.cue },
      { type: 'note', ...MOCK_FILES.note },
    ],
  };
}
