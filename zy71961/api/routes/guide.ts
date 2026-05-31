import { Router, type Request, type Response } from 'express'

const router = Router()

const guideSections = [
  {
    id: 'annotation-sample-placement',
    title: '标注样本放置指引',
    steps: [
      {
        step: 1,
        title: '确认样本格式',
        description: '标注样本文件需为JSON格式，包含label、content和可选的file_path字段。每个样本文件对应一个模型类别。',
      },
      {
        step: 2,
        title: '放置样本目录',
        description: '将样本文件放置于对应模型的samples目录下，命名规则为：{类别}_{序号}.json，例如：refund_001.json、exchange_002.json。',
      },
      {
        step: 3,
        title: '验证样本有效性',
        description: '上传后系统会自动解析并分类。请检查分类结果是否正确，特别是late_arrival和duplicate类型是否被正确识别。',
      },
      {
        step: 4,
        title: '关联结论与样本',
        description: '在报告结论中引用标注样本作为溯源依据，确保每条关键结论都有对应的样本支撑。',
      },
    ],
  },
  {
    id: 'training-set-leakage-check',
    title: '训练集泄漏检查',
    steps: [
      {
        step: 1,
        title: '导出线上预测样本',
        description: '从模型服务的日志中导出近期的线上预测样本，选取预测置信度异常高的样本（如置信度>0.99）作为疑似泄漏候选。',
      },
      {
        step: 2,
        title: '与训练集比对',
        description: '将候选样本与训练集进行相似度比对，可使用TF-IDF+余弦相似度或语义嵌入距离。相似度超过阈值的样本标记为疑似泄漏。',
      },
      {
        step: 3,
        title: '记录泄漏发现',
        description: '在漂移日报中添加"训练集标注样本疑似泄漏"结论，关联相关样本和评估指标作为溯源依据。',
      },
      {
        step: 4,
        title: '执行修复操作',
        description: '确认泄漏后，从训练集中移除泄漏样本，重新训练模型，并将修复操作记录到变更历史中。',
      },
    ],
  },
  {
    id: 'evaluation-review-before-export',
    title: '评估说明导出前复核',
    steps: [
      {
        step: 1,
        title: '检查评估指标完整性',
        description: '确认报告中所有关键指标（accuracy、f1_score、ndcg等）都有对应的评估记录，且基线值和漂移值均已填写。',
      },
      {
        step: 2,
        title: '验证结论与指标一致性',
        description: '使用一致性检查功能（/api/changes/consistency/:reportId），确认结论描述的漂移方向与实际指标漂移方向一致。',
      },
      {
        step: 3,
        title: '确认严重级别合理性',
        description: '检查结论的严重级别是否与实际漂移幅度匹配。critical级别应有显著漂移支撑，low级别不应有大幅漂移。',
      },
      {
        step: 4,
        title: '审核变更历史',
        description: '查看本报告相关的变更历史，确认所有手动修改都有合理理由，特别是严重级别调整和结论描述修改。',
      },
      {
        step: 5,
        title: '导出报告',
        description: '复核无误后，将报告导出为正式日报。导出内容包括：模型概览、评估指标、漂移结论、溯源链接和变更历史。',
      },
    ],
  },
]

router.get('/', (_req: Request, res: Response): void => {
  res.json({ success: true, data: guideSections })
})

export default router
