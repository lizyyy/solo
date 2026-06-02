import { FeedbackSource } from '../types';

export const mockFeedbacks: FeedbackSource[] = [
  {
    id: 'f1',
    rawText: '今天早高峰6点半到8点半，阳光社区活动中心挤满了人，估计有150人，大家都在找地方坐，感觉有点挤但还能接受。',
    reporter: '张阿姨',
    reportTime: '2026-06-01 09:15:00',
    locationDescription: '阳光社区活动中心',
    reportedPeople: 150,
    timePeriod: 'morning',
    shelterId: 's1'
  },
  {
    id: 'f2',
    rawText: '东门路口那个避难所昨天晚上人特别多，18点到21点大概有420人，好多人站在外面，太挤了，存在安全隐患！',
    reporter: '李先生',
    reportTime: '2026-06-01 22:30:00',
    locationDescription: '东门路口',
    reportedPeople: 420,
    timePeriod: 'evening',
    shelterId: 's2'
  },
  {
    id: 'f3',
    rawText: '东门口交叉口那边昨天晚上人太多了，我估摸着有380人左右，疏散通道都快堵了，建议赶紧处理。',
    reporter: '李先生',
    reportTime: '2026-06-02 08:45:00',
    locationDescription: '东门口交叉口',
    reportedPeople: 380,
    timePeriod: 'evening',
    shelterId: 's2',
    isDuplicate: true
  },
  {
    id: 'f4',
    rawText: '星光小学操场作为避难所，昨天下午到晚上大概有400人，按以前的标准500人还够用，但听说现在改了，不知道够不够。',
    reporter: '王老师',
    reportTime: '2026-06-01 20:00:00',
    locationDescription: '星光小学操场',
    reportedPeople: 400,
    timePeriod: 'afternoon',
    shelterId: 's3'
  },
  {
    id: 'f5',
    rawText: '东门红绿灯附近，晚上19点多有好多人聚集，大概200人，不知道是不是避难的。',
    reporter: '赵大爷',
    reportTime: '2026-06-01 19:30:00',
    locationDescription: '东门红绿灯',
    reportedPeople: 200,
    timePeriod: 'evening',
    shelterId: 's2'
  },
  {
    id: 'f6',
    rawText: '中心广场今天中午人也不少，大概120人在休息，秩序还可以。',
    reporter: '陈女士',
    reportTime: '2026-06-02 12:30:00',
    locationDescription: '社区广场',
    reportedPeople: 120,
    timePeriod: 'noon',
    shelterId: 's4'
  },
  {
    id: 'f7',
    rawText: '第二中学体育馆今天早高峰有250人，设计容量300人，问题不大。',
    reporter: '刘校长',
    reportTime: '2026-06-02 10:00:00',
    locationDescription: '二中体育馆',
    reportedPeople: 250,
    timePeriod: 'morning',
    shelterId: 's5'
  }
];
