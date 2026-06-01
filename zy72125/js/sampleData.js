const SAMPLE_DATA = [
  {
    performanceDate: '2026-05-20',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    songName: '夜空中最亮的星',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '20260520_SH_夜空中最亮的星_主唱麦.wav',
    fileFormat: 'WAV',
    duration: '5:23',
    sourceType: '微信群截图',
    sourceDetail: '排练群5月19日聊天记录，小王发的输入表截图',
    remark: '主唱使用Shure Beta58A',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-20',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    songName: '夜空中最亮的星',
    inputType: '吉他',
    channelNumber: '3',
    fileName: '20260520_SH_夜空中最亮的星_吉他.wav',
    fileFormat: 'WAV',
    duration: '5:24',
    sourceType: '文件夹',
    sourceDetail: '录音师老许本地归档 /2026巡演/上海站/',
    remark: '木吉他DI+话筒双通道',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-20',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    songName: '夜空中最亮的星',
    inputType: '键盘',
    channelNumber: '5',
    fileName: '20260520_SH_夜空中最亮的星_键盘.wav',
    fileFormat: 'WAV',
    duration: '5:22',
    sourceType: '邮件',
    sourceDetail: '键盘手小李5月21日邮件发送',
    remark: '',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-20',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    songName: '奔跑',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '20260520_SH_奔跑_主唱麦.wav',
    fileFormat: 'WAV',
    duration: '4:15',
    sourceType: '微信群截图',
    sourceDetail: '排练群5月19日聊天记录',
    remark: '',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-20',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    songName: '奔跑',
    inputType: '贝斯',
    channelNumber: '4',
    fileName: '20260520_SH_奔跑_Bass.wav',
    fileFormat: 'WAV',
    duration: '4:16',
    sourceType: '文件夹',
    sourceDetail: '录音师老许本地归档 /2026巡演/上海站/',
    remark: '中英文混用命名',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-20',
    city: '上海',
    venue: '梅赛德斯奔驰文化中心',
    songName: '奔跑',
    inputType: '鼓组',
    channelNumber: '',
    fileName: '20260520_SH_奔跑_鼓组.wav',
    fileFormat: 'WAV',
    duration: '4:14',
    sourceType: '文件夹',
    sourceDetail: '录音师老许本地归档',
    remark: '通道号未标注，需核对调音台',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-23',
    city: '北京',
    venue: '国家体育馆',
    songName: '夜空中最亮的星',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '20260523_BJ_夜空中最亮的星_主唱麦.wav',
    fileFormat: 'WAV',
    duration: '5:25',
    sourceType: '现场补录',
    sourceDetail: '北京站现场录音补录',
    remark: '',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-23',
    city: '北京',
    venue: '国家体育馆',
    songName: '夜空中最亮的星',
    inputType: '和声麦',
    channelNumber: '2',
    fileName: '20260523_BJ_夜空中最亮的星_和声麦.wav',
    fileFormat: 'WAV',
    duration: '5:25',
    sourceType: '现场补录',
    sourceDetail: '北京站现场录音补录',
    remark: '和声1+和声2共用通道2，需拆分',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-23',
    city: '北京',
    venue: '国家体育馆',
    songName: '我们的梦',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '20260523_BJ_我们的梦_主唱麦.wav',
    fileFormat: 'WAV',
    duration: '0:08',
    sourceType: 'QQ群截图',
    sourceDetail: '技术群5月24日截图',
    remark: '文件可能不完整',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-23',
    city: '北京',
    venue: '国家体育馆',
    songName: '我们的梦',
    inputType: '吉他',
    channelNumber: '3',
    fileName: '20260523_BJ_我们的梦_吉他.wav',
    fileFormat: 'WAV',
    duration: '6:42',
    sourceType: 'QQ群截图',
    sourceDetail: '技术群5月24日截图',
    remark: '',
    status: '待核对'
  },
  {
    performanceDate: '2026-05-23',
    city: '北京',
    venue: '国家体育馆',
    songName: '我们的梦',
    inputType: 'Program',
    channelNumber: '8',
    fileName: '20260523_BJ_我们的梦_Program.wav',
    fileFormat: 'WAV',
    duration: '6:40',
    sourceType: '演出方提供',
    sourceDetail: '演出场馆技术组提供',
    remark: '',
    status: '待核对'
  },
  {
    performanceDate: '2026-06-10',
    city: '成都',
    venue: '',
    songName: '夜空中最亮的星',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '20260610_CD_夜空中最亮的星_主唱麦.wav',
    fileFormat: 'WAV',
    duration: '5:20',
    sourceType: '',
    sourceDetail: '',
    remark: '场地待定，文件名暂用CD缩写',
    status: '待核对'
  },
  {
    performanceDate: '2026-06-10',
    city: '成都',
    venue: '',
    songName: '夜空中最亮的星',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '20260610_CD_夜空中最亮的星_主唱麦.wav',
    fileFormat: 'WAV',
    duration: '5:20',
    sourceType: '',
    sourceDetail: '',
    remark: '重复录入？需确认',
    status: '待核对'
  },
  {
    performanceDate: '2026-06-10',
    city: '成都',
    venue: '',
    songName: '',
    inputType: '环境音',
    channelNumber: '150',
    fileName: '20260610_CD_ambience_环境音.tmp',
    fileFormat: '',
    duration: '2:35:00',
    sourceType: '其他来源',
    sourceDetail: '不明来源文件',
    remark: '整场录音？通道号异常，文件格式异常',
    status: '待核对'
  },
  {
    performanceDate: '2026-06-15',
    city: '广州',
    venue: '广州体育馆',
    songName: 'Intro 序曲',
    inputType: 'Program',
    channelNumber: '8',
    fileName: '20260615_GZ_Intro 序曲 Program.wav',
    fileFormat: 'WAV',
    duration: '8:30',
    sourceType: '演出方提供',
    sourceDetail: '广州站主办方提前提供',
    remark: 'Intro通常较短，8分半可能有误',
    status: '待核对'
  },
  {
    performanceDate: '',
    city: '深圳',
    venue: '深圳湾体育中心',
    songName: '奔跑',
    inputType: '主唱麦',
    channelNumber: '1',
    fileName: '奔跑_主唱_深圳_未标日期.wav',
    fileFormat: 'WAV',
    duration: '4:10',
    sourceType: '录音师备注',
    sourceDetail: '老许手写便签，日期不明',
    remark: '日期缺失，从文件内容推断为深圳站',
    status: '待核对'
  },
  {
    performanceDate: '2026-07-01',
    city: '杭州',
    venue: '黄龙体育中心',
    songName: 'Outro 尾奏',
    inputType: '吉他',
    channelNumber: '3',
    fileName: '20260701_HZ_尾奏_吉他.wav',
    fileFormat: 'FLAC',
    duration: '7:15',
    sourceType: '邮件',
    sourceDetail: '吉他手6月30日邮件',
    remark: '尾奏通常较短，7分多钟需确认',
    status: '待核对'
  },
  {
    performanceDate: '2026-07-01',
    city: '杭州',
    venue: '黄龙体育中心',
    songName: '夜空中最亮的星',
    inputType: '弦乐',
    channelNumber: '6',
    fileName: '20260701_HZ_夜空中最亮的星_弦乐.flac',
    fileFormat: 'FLAC',
    duration: '5:18',
    sourceType: '邮件',
    sourceDetail: '弦乐组长6月28日邮件发送分轨',
    remark: '4把小提琴+2把大提琴合为1轨',
    status: '待核对'
  }
];

function loadSampleData() {
  if (DataManager.records.length > 0) {
    if (!confirm('当前已有数据，加载样例会追加数据。是否继续？')) {
      return;
    }
  }

  DataManager.takeSnapshot();

  const results = DataManager.batchAddRecords(SAMPLE_DATA);

  Validator.validateAllRecords();

  const diff = DataManager.compareSnapshot();

  App.showToast(`已加载 ${results.length} 条样例数据`, 'success');
  App.renderTable();
  App.updateStats();

  if (diff && (diff.added.length > 0 || diff.modified.length > 0)) {
    App.showDiff(diff);
  }
}
