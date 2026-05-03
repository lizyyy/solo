export const sampleAudioMarkersCSV = `id,start_time,end_time,type,confidence
1,00:00:00.000,00:00:02.500,silence,0.95
2,00:00:02.500,00:00:05.200,speech,0.98
3,00:00:05.200,00:00:05.800,silence,0.92
4,00:00:05.800,00:00:09.300,speech,0.99
5,00:00:09.300,00:00:11.000,silence,0.94
6,00:00:11.000,00:00:14.500,speech,0.97
7,00:00:14.500,00:00:15.200,silence,0.96
8,00:00:15.200,00:00:18.800,speech,0.98
9,00:00:18.800,00:00:20.000,silence,0.93
10,00:00:20.000,00:00:23.500,speech,0.99
`;

export const sampleSubtitlesSRT = `1
00:00:02,000 --> 00:00:05,000
大家好，欢迎收看本期节目

2
00:00:04,800 --> 00:00:09,000
今天我们来聊一聊关于字幕对齐的问题，这是一个非常重要的话题

3
00:00:09,000 --> 00:00:14,000
很多字幕制作人员都会遇到时间不对齐的情况，这会影响观众的观看体验

4
00:00:14,200 --> 00:00:18,500
所以我们需要一个工具来帮助我们检查和修正这些问题

5
00:00:18,600 --> 00:00:23,000
这个离线字幕对齐复核器就是为了解决这个问题而设计的
`;

export const sampleProgramSegmentsJSON = `[
  {
    "id": "segment-1",
    "name": "开场介绍",
    "startTime": 0,
    "endTime": 10,
    "segmentType": "intro"
  },
  {
    "id": "segment-2",
    "name": "主题讨论",
    "startTime": 10,
    "endTime": 18,
    "segmentType": "discussion"
  },
  {
    "id": "segment-3",
    "name": "总结结尾",
    "startTime": 18,
    "endTime": 25,
    "segmentType": "outro"
  }
]`;
