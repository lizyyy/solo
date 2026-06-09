import type { WeightRecord } from '../types'

export const weightRecords: WeightRecord[] = [
  // 大橘 p001 —— 有改名、旧版曲线、口头备注
  { id: 'r101', petId: 'p001', date: '2026-01-10', weight: 7.8, source: 'official', isIncluded: true, credibility: 5, capturedByName: '大橘', note: '入站称重,体脂仪' },
  { id: 'r102', petId: 'p001', date: '2026-02-15', weight: 7.5, source: 'official', isIncluded: true, credibility: 5, capturedByName: '大橘' },
  { id: 'r103', petId: 'p001', date: '2026-03-20', weight: 7.1, source: 'old_version', versionLabel: '旧版2026-03', isIncluded: false, credibility: 3, capturedByName: '胖胖', note: '旧Excel手写台账,与体脂仪差异0.3kg,已改用新数据' },
  { id: 'r104', petId: 'p001', date: '2026-03-20', weight: 6.8, source: 'official', isIncluded: true, credibility: 5, capturedByName: '大橘', note: '体脂仪复测,替代旧版7.1kg' },
  { id: 'r105', petId: 'p001', date: '2026-04-18', weight: 6.7, source: 'name_change', isIncluded: true, credibility: 4, capturedByName: '橘子', note: '领养人张阿姨补充记录,当时以"橘子"称呼录入,已映射至大橘' },
  { id: 'r106', petId: 'p001', date: '2026-05-16', weight: 6.5, source: 'verbal', isIncluded: false, credibility: 2, capturedByName: '橘猫先生', note: '领养人电话口头报6.5,与下次称重差距较大,暂不纳入但保留' },
  { id: 'r107', petId: 'p001', date: '2026-05-22', weight: 6.6, source: 'official', isIncluded: true, credibility: 5, capturedByName: '大橘' },
  { id: 'r108', petId: 'p001', date: '2026-06-07', weight: 6.4, source: 'official', isIncluded: true, credibility: 5, capturedByName: '大橘', note: '回访称重' },

  // 柯壮壮 p002 —— 有改名+疫苗缺失
  { id: 'r201', petId: 'p002', date: '2026-01-05', weight: 16.2, source: 'official', isIncluded: true, credibility: 5, capturedByName: '柯基一号' },
  { id: 'r202', petId: 'p002', date: '2026-02-12', weight: 15.7, source: 'official', isIncluded: true, credibility: 5, capturedByName: '短腿哥' },
  { id: 'r203', petId: 'p002', date: '2026-03-10', weight: 15.3, source: 'official', isIncluded: true, credibility: 5, capturedByName: '壮壮', note: '正式更名为柯壮壮' },
  { id: 'r204', petId: 'p002', date: '2026-04-08', weight: 15.0, source: 'missing_vaccine', isIncluded: false, credibility: 3, capturedByName: '柯壮壮', note: '应打疫苗当日未测,领养人补发家用秤数字,疫苗日期缺失' },
  { id: 'r205', petId: 'p002', date: '2026-04-15', weight: 15.1, source: 'official', isIncluded: true, credibility: 5, capturedByName: '柯壮壮', note: '补测疫苗日称重' },
  { id: 'r206', petId: 'p002', date: '2026-05-10', weight: 14.9, source: 'official', isIncluded: true, credibility: 5, capturedByName: '柯壮壮' },
  { id: 'r207', petId: 'p002', date: '2026-06-05', weight: 14.8, source: 'official', isIncluded: true, credibility: 5, capturedByName: '柯壮壮', note: '回访称重' },

  // 黑糖 p003 —— 少量口头备注
  { id: 'r301', petId: 'p003', date: '2026-02-20', weight: 5.1, source: 'official', isIncluded: true, credibility: 5, capturedByName: '黑糖' },
  { id: 'r302', petId: 'p003', date: '2026-03-25', weight: 4.9, source: 'official', isIncluded: true, credibility: 5, capturedByName: '糖糖' },
  { id: 'r303', petId: 'p003', date: '2026-04-22', weight: 4.8, source: 'official', isIncluded: true, credibility: 5, capturedByName: '黑糖' },
  { id: 'r304', petId: 'p003', date: '2026-05-20', weight: 4.7, source: 'verbal', isIncluded: true, credibility: 4, capturedByName: '小黑', note: '领养人微信拍秤,与历史趋势一致,纳入' },
  { id: 'r305', petId: 'p003', date: '2026-06-06', weight: 4.6, source: 'official', isIncluded: true, credibility: 5, capturedByName: '黑糖' },

  // 毛豆 p004 —— 有旧版曲线
  { id: 'r401', petId: 'p004', date: '2026-01-22', weight: 9.4, source: 'official', isIncluded: true, credibility: 5, capturedByName: '豆豆' },
  { id: 'r402', petId: 'p004', date: '2026-02-28', weight: 9.0, source: 'old_version', versionLabel: '旧版2026-02', isIncluded: false, credibility: 2, capturedByName: '毛豆豆', note: '旧台账手工抄写8.9kg,复核发现多写0.1kg,已更正' },
  { id: 'r403', petId: 'p004', date: '2026-02-28', weight: 8.9, source: 'official', isIncluded: true, credibility: 5, capturedByName: '毛豆' },
  { id: 'r404', petId: 'p004', date: '2026-03-25', weight: 8.6, source: 'official', isIncluded: true, credibility: 5, capturedByName: '毛豆' },
  { id: 'r405', petId: 'p004', date: '2026-04-30', weight: 8.3, source: 'official', isIncluded: true, credibility: 5, capturedByName: '豆豆' },
  { id: 'r406', petId: 'p004', date: '2026-06-04', weight: 8.1, source: 'official', isIncluded: true, credibility: 5, capturedByName: '毛豆' },

  // 奶黄 p005 —— 复杂多异常：改名+口头+疫苗缺失+冲突
  { id: 'r501', petId: 'p005', date: '2026-03-01', weight: 6.2, source: 'official', isIncluded: true, credibility: 5, capturedByName: '小黄' },
  { id: 'r502', petId: 'p005', date: '2026-03-30', weight: 6.1, source: 'verbal', isIncluded: false, credibility: 2, capturedByName: '奶包', note: '领养人电话报6.1,但次日来访称6.3,冲突大,弃用' },
  { id: 'r503', petId: 'p005', date: '2026-03-31', weight: 6.3, source: 'official', isIncluded: true, credibility: 5, capturedByName: '奶黄', note: '正式更名为奶黄' },
  { id: 'r504', petId: 'p005', date: '2026-04-28', weight: 6.0, source: 'missing_vaccine', isIncluded: false, credibility: 2, capturedByName: '奶黄', note: '应第二针疫苗当天未到,补发称重存疑,疫苗日期缺失' },
  { id: 'r505', petId: 'p005', date: '2026-05-05', weight: 6.1, source: 'official', isIncluded: true, credibility: 5, capturedByName: '奶黄', note: '补测' },
  { id: 'r506', petId: 'p005', date: '2026-05-29', weight: 5.9, source: 'old_version', versionLabel: '待复核版', isIncluded: false, credibility: 1, capturedByName: '小黄', note: '旧档又翻出一条以"小黄"录入的5.9kg,但同日已有体脂仪6.0kg' },
  { id: 'r507', petId: 'p005', date: '2026-05-29', weight: 6.0, source: 'official', isIncluded: true, credibility: 5, capturedByName: '奶黄' },
  { id: 'r508', petId: 'p005', date: '2026-06-08', weight: 5.9, source: 'official', isIncluded: true, credibility: 5, capturedByName: '奶黄', note: '回访称重' },

  // 饭团 p006 —— 完全正常,无异常
  { id: 'r601', petId: 'p006', date: '2026-02-10', weight: 12.6, source: 'official', isIncluded: true, credibility: 5, capturedByName: '饭团' },
  { id: 'r602', petId: 'p006', date: '2026-03-15', weight: 12.3, source: 'official', isIncluded: true, credibility: 5, capturedByName: '团团' },
  { id: 'r603', petId: 'p006', date: '2026-04-12', weight: 12.1, source: 'official', isIncluded: true, credibility: 5, capturedByName: '白饭团' },
  { id: 'r604', petId: 'p006', date: '2026-05-10', weight: 12.0, source: 'official', isIncluded: true, credibility: 5, capturedByName: '饭团' },
  { id: 'r605', petId: 'p006', date: '2026-06-03', weight: 11.9, source: 'official', isIncluded: true, credibility: 5, capturedByName: '饭团' },
]
