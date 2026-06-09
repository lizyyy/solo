import type { TraceNode, ReviewDecision, AbnormalRecordNote, DeliveryCard } from '../types'

export const traceNodes: TraceNode[] = [
  // a001 大橘旧版曲线
  { id: 't101', anomalyId: 'a001', step: 1, type: 'original', title: '原始结论', detail: '按旧版台账3月20日7.1kg计算3月减重率', beforeValue: '3月减重 0.4kg / 5.3%' },
  { id: 't102', anomalyId: 'a001', step: 2, type: 'conflict', title: '冲突来源', detail: '翻出同日体脂仪记录6.8kg(来源:正规称重5星)', beforeValue: '7.1kg', afterValue: '6.8kg', delta: '-0.3kg' },
  { id: 't103', anomalyId: 'a001', step: 3, type: 'analysis', title: '冲突分析', detail: '旧版台账3星可信度,体脂仪5星且日期一致,优先采信体脂仪' },
  { id: 't104', anomalyId: 'a001', step: 4, type: 'human_decision', title: '小乔人工判读', detail: '对比历史趋势,6.8kg衔接2月7.5kg更平滑,7.1kg会导致异常台阶' },
  { id: 't105', anomalyId: 'a001', step: 5, type: 'final', title: '最终结论', detail: '使用体脂仪6.8kg,旧版7.1kg标记"归档不纳入"', afterValue: '3月减重 0.7kg / 9.3%', delta: '减重率+4.0pp' },

  // a002 大橘改名
  { id: 't201', anomalyId: 'a002', step: 1, type: 'original', title: '原始结论', detail: '4月只找到3月20日-5月16日数据,中间断裂', beforeValue: '4月缺记录 减重率不可算' },
  { id: 't202', anomalyId: 'a002', step: 2, type: 'conflict', title: '改名识别', detail: '张阿姨提交记录署名"橘子",系统无此名字', beforeValue: '无法匹配档案' },
  { id: 't203', anomalyId: 'a002', step: 3, type: 'analysis', title: '关联分析', detail: '比对日期4月18日+体重6.7kg与大橘曲线吻合,确认"橘子"即大橘' },
  { id: 't204', anomalyId: 'a002', step: 4, type: 'human_decision', title: '小乔人工判读', detail: '登记"橘子"为大橘别名,记录纳入并标注来源' },
  { id: 't205', anomalyId: 'a002', step: 5, type: 'final', title: '最终结论', detail: '补上4月记录,4月-0.1kg衔接平滑', afterValue: '4月减重 0.1kg / 1.5%', delta: '可计算4月' },

  // a005 柯壮壮疫苗缺失
  { id: 't301', anomalyId: 'a005', step: 1, type: 'original', title: '原始需求', detail: '疫苗日必须同步称重,4月8日未到' },
  { id: 't302', anomalyId: 'a005', step: 2, type: 'conflict', title: '补发数据问题', detail: '领养人补发家用秤15.0kg,但无对应疫苗接种记录' },
  { id: 't303', anomalyId: 'a005', step: 3, type: 'analysis', title: '流程分析', detail: '救助站规定"疫苗日称重"必须与医疗系统同步,缺失疫苗日期=称重无效' },
  { id: 't304', anomalyId: 'a005', step: 4, type: 'human_decision', title: '小乔人工判读', detail: '标记为"非正常记录",通知领养人7天内回站补测+补打' },
  { id: 't305', anomalyId: 'a005', step: 5, type: 'final', title: '最终处理', detail: '15.0kg不纳入,4月15日补测15.1kg(有补打疫苗记录)纳入', afterValue: '4月减重 0.2kg / 1.3%', delta: '日期从4/8→4/15' },

  // a009 奶黄冲突数据
  { id: 't401', anomalyId: 'a009', step: 1, type: 'original', title: '原始接收', detail: '3月30日领养人电话报6.1kg(口头,2星)' },
  { id: 't402', anomalyId: 'a009', step: 2, type: 'conflict', title: '次日实测冲突', detail: '3月31日回访站里体脂仪测6.3kg,差0.2kg+方向相反' },
  { id: 't403', anomalyId: 'a009', step: 3, type: 'analysis', title: '严重级别判定', detail: '差值≥0.2kg且方向相反=影响趋势判断,标记critical' },
  { id: 't404', anomalyId: 'a009', step: 4, type: 'human_decision', title: '待小乔人工判读', detail: '需与领养人确认3月30日是否确实称重、是否看错秤' },
  { id: 't405', anomalyId: 'a009', step: 5, type: 'final', title: '临时结论', detail: '暂采信体脂仪6.3kg,待电话核实后最终定案', beforeValue: '6.1kg', afterValue: '6.3kg', delta: '+0.2kg 方向相反' },

  // a004 柯壮壮改名链
  { id: 't501', anomalyId: 'a004', step: 1, type: 'original', title: '原始档案', detail: '3份台账各自孤立:柯基一号/短腿哥/壮壮' },
  { id: 't502', anomalyId: 'a004', step: 2, type: 'conflict', title: '拆分风险', detail: '系统按名称匹配,准备创建3条不同档案' },
  { id: 't503', anomalyId: 'a004', step: 3, type: 'analysis', title: '特征比对', detail: '体重连续递减+领养人相同+照片相同,确认是同一条柯基' },
  { id: 't504', anomalyId: 'a004', step: 4, type: 'human_decision', title: '小乔人工判读', detail: '统一更名为"柯壮壮",三条曾用名登记别名' },
  { id: 't505', anomalyId: 'a004', step: 5, type: 'final', title: '最终结论', detail: '3份台账合并,完整1月-3月曲线可用', afterValue: '减重 0.9kg / 5.6%', delta: '从不可算→可算' },
]

export const reviewDecisions: ReviewDecision[] = [
  { id: 'd001', anomalyId: 'a001', petId: 'p001', reviewer: '小乔', reviewedAt: '2026-04-03', reason: '体脂仪数据可信度高于手工台账,6.8kg曲线更平滑', beforeWeight: 7.1, afterWeight: 6.8, beforeRate: '3月 -0.4kg (5.3%)', afterRate: '3月 -0.7kg (9.3%)', signatureEmoji: '✍️' },
  { id: 'd002', anomalyId: 'a002', petId: 'p001', reviewer: '小乔', reviewedAt: '2026-04-20', reason: '与领养人确认"橘子"为旧昵称,体重趋势吻合', beforeWeight: 6.7, afterWeight: 6.7, beforeRate: '4月 缺失记录', afterRate: '4月 -0.1kg (1.5%)', signatureEmoji: '✍️' },
  { id: 'd003', anomalyId: 'a004', petId: 'p002', reviewer: '小乔', reviewedAt: '2026-03-15', reason: '3个名字照片体重全部匹配,为同一只柯基', beforeWeight: 0, afterWeight: 0, beforeRate: '3份独立档案无曲线', afterRate: '合并后完整曲线', signatureEmoji: '🐾' },
  { id: 'd004', anomalyId: 'a005', petId: 'p002', reviewer: '小乔', reviewedAt: '2026-04-16', reason: '救助站规则:疫苗日称重必须有疫苗记录,家用秤不符合流程', beforeWeight: 15.0, afterWeight: 15.1, beforeRate: '4月 -0.3kg (2.0%)', afterRate: '4月 -0.2kg (1.3%)', signatureEmoji: '✍️' },
  { id: 'd005', anomalyId: 'a006', petId: 'p003', reviewer: '小乔', reviewedAt: '2026-05-21', reason: '拍秤照片与前后数据差≤0.1kg,趋势一致', beforeWeight: 4.7, afterWeight: 4.7, beforeRate: '5月 缺失记录', afterRate: '5月 -0.1kg (2.1%)', signatureEmoji: '🐾' },
  { id: 'd006', anomalyId: 'a007', petId: 'p004', reviewer: '小乔', reviewedAt: '2026-03-10', reason: '查原始记录本核实为抄写错误,实际8.9kg', beforeWeight: 9.0, afterWeight: 8.9, beforeRate: '2月 -0.4kg (4.3%)', afterRate: '2月 -0.5kg (5.3%)', signatureEmoji: '✍️' },
  { id: 'd007', anomalyId: 'a008', petId: 'p004', reviewer: '小乔', reviewedAt: '2026-03-28', reason: '核对入站登记表和照片,豆豆/毛豆豆即毛豆', beforeWeight: 0, afterWeight: 0, beforeRate: '入站体重丢失', afterRate: '完整入站记录', signatureEmoji: '🐾' },
]

export const abnormalNotes: AbnormalRecordNote[] = [
  {
    id: 'n001',
    petId: 'p002',
    recordId: 'r204',
    title: '4月8日疫苗日称重缺失',
    reasonWhySkipped: '该日是第二针疫苗约定日,救助站SOP要求"称重必须和疫苗同步完成"。当日领养人未带狗来打疫苗,也无法提供医疗系统的疫苗编号/日期,不符合正规称重的流程条件。',
    handling: '1) 补发的家用秤15.0kg标记为"非正常记录"不纳入计算;\n2) 记录在异常追溯链中留痕;\n3) 电话通知领养人7天内回站补测+补打疫苗;\n4) 4月15日回站补测15.1kg(附补打疫苗编号)正式纳入。',
    impactLevel: 'high',
    impactDescription: '日期从4月8日推迟至4月15日,导致4月-5月的间隔从32天缩短为25天,减重率计算轻微偏向4月一侧。',
    impactPercent: 65,
  },
  {
    id: 'n002',
    petId: 'p005',
    recordId: 'r504',
    title: '4月28日第二针疫苗称重缺失',
    reasonWhySkipped: '与柯壮壮事件类似,第二针疫苗未按约定日完成,领养人自行在家称重后补发,但医疗系统中找不到对应疫苗接种记录,流程不合规。',
    handling: '1) 补发6.0kg标记不纳入;\n2) 待人工判读:需与领养人确认疫苗何时补打;\n3) 5月5日回站补测6.1kg已纳入。',
    impactLevel: 'high',
    impactDescription: '4月30天区间数据错位,4月减重率无法准确评估。',
    impactPercent: 72,
  },
  {
    id: 'n003',
    petId: 'p001',
    recordId: 'r103',
    title: '3月20日旧版台账数据冲突',
    reasonWhySkipped: '旧Excel台账由前任志愿者手写录入,记录的7.1kg与同日体脂仪的6.8kg存在0.3kg差距。体脂仪是站里的标准设备(带校准标签),而旧台账无复核签名。',
    handling: '1) 7.1kg标记为"旧版/归档",不参与最终计算;\n2) 以体脂仪6.8kg为准;\n3) 冲突点在追溯链中高亮说明。',
    impactLevel: 'medium',
    impactDescription: '3月减重率从5.3%修正至9.3%,差异较大。',
    impactPercent: 50,
  },
  {
    id: 'n004',
    petId: 'p005',
    recordId: 'r502',
    title: '3月30日口头数据与次日实测冲突',
    reasonWhySkipped: '口头报6.1kg与3月31日体脂仪6.3kg差0.2kg,且方向相反(本应减重却显示增重),属于方向级别的数据冲突。',
    handling: '1) 口头6.1kg暂不纳入;\n2) 异常标记为critical待人工复核;\n3) 已留痕在追溯链,需与领养人电话确认。',
    impactLevel: 'critical',
    impactDescription: '若采信将误判3月趋势为减重,实际体重小幅回升。',
    impactPercent: 90,
  },
]

export const deliveryCards: DeliveryCard[] = [
  {
    id: 'dc001',
    petId: 'p001',
    anomalyId: 'a001',
    summaryText: '【大橘】3月20日旧版台账7.1kg vs 体脂仪6.8kg冲突\n冲突源:旧Excel手工台账(3星可信度)\n处理人:小乔 2026-04-03',
    curveHighlight: { date: '2026-03-20', weightDiff: '7.1→6.8 (-0.3kg)', arrowNote: '此处旧版7.1kg被弃用,改用体脂仪6.8kg' },
    impactStatement: '此异常导致3月减重率从5.3%修正为9.3%,+4.0pp。结论变化大,已纳入人工改判。',
  },
  {
    id: 'dc002',
    petId: 'p001',
    anomalyId: 'a002',
    summaryText: '【大橘】4月18日记录署名"橘子",未匹配主档\n改名映射:橘子→大橘\n处理人:小乔 2026-04-20',
    curveHighlight: { date: '2026-04-18', weightDiff: '记录补入', arrowNote: '"橘子"被识别为大橘别名,4月数据点从缺失→补入' },
    impactStatement: '此改名异常补上了4月中间点,减重率从"4月不可算"变为可算(-0.1kg, 1.5%)。',
  },
  {
    id: 'dc003',
    petId: 'p002',
    anomalyId: 'a004',
    summaryText: '【柯壮壮】曾用名拆分:柯基一号/短腿哥/壮壮\n3份台账差点独立建档\n处理人:小乔 2026-03-15',
    curveHighlight: { date: '2026-01-05至03-10', weightDiff: '3条档案合并', arrowNote: '3种称呼全部映射至"柯壮壮",曲线从3段碎片→1条完整' },
    impactStatement: '此改名异常是结论成立的前提:没有合并就没有完整减重曲线(16.2→15.3, 0.9kg/5.6%)。',
  },
  {
    id: 'dc004',
    petId: 'p002',
    anomalyId: 'a005',
    summaryText: '【柯壮壮】4月8日疫苗日称重缺失(疫苗无记录)\n流程不合规打回补测\n处理人:小乔 2026-04-16',
    curveHighlight: { date: '2026-04-08/04-15', weightDiff: '15.0→15.1', arrowNote: '4月8日因缺疫苗记录被拒绝,4月15日补测(附疫苗记录)纳入' },
    impactStatement: '此非正常记录使4月数据点推迟7天,减重率从2.0%修正为1.3%,影响中等。关键是说明了"为什么没有按正常记录走"——疫苗日期缺失。',
  },
  {
    id: 'dc005',
    petId: 'p005',
    anomalyId: 'a009',
    summaryText: '【奶黄】3月30日口头6.1 vs 次日6.3冲突(方向相反)\n待人工确认中\n处理状态:未处理',
    curveHighlight: { date: '2026-03-30/03-31', weightDiff: '6.1→6.3 (+0.2kg反向)', arrowNote: '口头报"减重"实际"增重",差0.2kg且方向相反' },
    impactStatement: '此异常影响极严重(critical),直接关系到3月趋势判断方向。暂采信体脂仪6.3kg,待与领养人电话确认后最终定案。',
  },
  {
    id: 'dc006',
    petId: 'p005',
    anomalyId: 'a010',
    summaryText: '【奶黄】4月28日第二针疫苗称重缺失\n处理状态:未处理',
    curveHighlight: { date: '2026-04-28', weightDiff: '6.0 未纳入', arrowNote: '疫苗日期缺失,补发数据不按正常记录走' },
    impactStatement: '此非正常记录使4月减重率计算缺关键节点,待疫苗补打后结论才能稳。',
  },
  {
    id: 'dc007',
    petId: 'p004',
    anomalyId: 'a007',
    summaryText: '【毛豆】2月28日旧版手抄写多0.1kg(9.0→8.9)\n查原始记录本核实\n处理人:小乔 2026-03-10',
    curveHighlight: { date: '2026-02-28', weightDiff: '9.0→8.9 (-0.1kg)', arrowNote: '旧版手抄写多了0.1kg,核实后纠正' },
    impactStatement: '此旧版曲线异常导致2月减重率从4.3%→5.3%,+1.0pp。',
  },
]
