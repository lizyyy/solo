const store = require('../src/store')
const { SAMPLE_STATUS } = require('../src/constants')

const initSampleData = () => {
  console.log('开始初始化样例数据...')

  store.saveBatches([])
  store.saveSamples([])
  store.saveOperationLogs([])

  const batch1 = store.createBatch({
    name: '20240601_灰度批次_v1.0',
    modelVersion: 'v1.0',
    totalCount: 10,
    status: 'imported',
    importedBy: '周姐'
  })

  const batch1Samples = []
  for (let i = 1; i <= 10; i++) {
    const sample = store.createSample({
      batchId: batch1.id,
      sampleId: `SAMPLE-${String(i).padStart(4, '0')}`,
      modelVersion: 'v1.0',
      originalRowNumber: i,
      originalData: {
        sampleId: `SAMPLE-${String(i).padStart(4, '0')}`,
        content: `排班场景${i}：员工${i}的排班需求`,
        schedulingSuggestion: `建议排班：${i}号早班`,
        annotatorComment: i % 5 === 0 ? '标注员备注：该样本需要重点关注' : ''
      },
      content: `排班场景${i}：员工${i}的排班需求`,
      schedulingSuggestion: `建议排班：${i}号早班`,
      annotatorComment: i % 5 === 0 ? '标注员备注：该样本需要重点关注' : '',
      manualChanges: {},
      matchedRules: [{
        code: 'NORMAL_SAMPLE',
        name: '正常样本',
        description: '无异常的样本记录',
        autoStatus: SAMPLE_STATUS.NORMAL,
        requireReview: false,
        allowAutoNormal: true,
        explanation: '样本数据正常，无异常标记。'
      }],
      status: SAMPLE_STATUS.NORMAL,
      explanation: '样本数据正常，无异常标记。',
      createdBy: '周姐'
    })
    batch1Samples.push(sample)

    store.addOperationLog({
      batchId: batch1.id,
      sampleId: sample.id,
      type: 'batch_import',
      operator: '周姐',
      operatorRole: 'annotation_lead',
      detail: `导入第 ${i} 行样本，初始状态：${SAMPLE_STATUS.NORMAL}`,
      beforeState: null,
      afterState: { status: SAMPLE_STATUS.NORMAL, matchedRules: ['NORMAL_SAMPLE'] }
    })
  }

  console.log(`✅ 批次1创建完成：${batch1.name}，共 ${batch1Samples.length} 条样本`)

  const batch2 = store.createBatch({
    name: '20240607_灰度批次_v2.0',
    modelVersion: 'v2.0',
    totalCount: 10,
    status: 'imported',
    importedBy: '周姐'
  })

  const batch2Samples = []
  for (let i = 1; i <= 10; i++) {
    const isModelChanged = i <= 7
    const matchedRules = []
    let status = SAMPLE_STATUS.NORMAL
    let explanation = ''

    if (isModelChanged) {
      matchedRules.push({
        code: 'MODEL_VERSION_CHANGED_SAME_ID',
        name: '模型版本换了但样本编号没变',
        description: '同一批次或跨批次中，样本编号相同但模型版本号不一致',
        autoStatus: SAMPLE_STATUS.MODEL_VERSION_CHANGED,
        requireReview: true,
        allowAutoNormal: false,
        explanation: '该样本编号在之前批次中使用过，但本次使用的模型版本不同。需要运营复核人确认是否为正常迭代。',
        previousModelVersion: 'v1.0',
        previousBatchId: batch1.id
      })
      status = SAMPLE_STATUS.MODEL_VERSION_CHANGED
      explanation = `该样本编号在之前批次中使用过，但本次使用的模型版本不同。需要运营复核人确认是否为正常迭代。 前次模型版本：v1.0，本次模型版本：v2.0`
    } else {
      matchedRules.push({
        code: 'NORMAL_SAMPLE',
        name: '正常样本',
        description: '无异常的样本记录',
        autoStatus: SAMPLE_STATUS.NORMAL,
        requireReview: false,
        allowAutoNormal: true,
        explanation: '样本数据正常，无异常标记。'
      })
      status = SAMPLE_STATUS.NORMAL
      explanation = '样本数据正常，无异常标记。'
    }

    const sample = store.createSample({
      batchId: batch2.id,
      sampleId: `SAMPLE-${String(i).padStart(4, '0')}`,
      modelVersion: 'v2.0',
      originalRowNumber: i,
      originalData: {
        sampleId: `SAMPLE-${String(i).padStart(4, '0')}`,
        content: `排班场景${i}：员工${i}的排班需求（v2.0优化）`,
        schedulingSuggestion: `建议排班：${i}号早班（v2.0调整）`,
        annotatorComment: ''
      },
      content: `排班场景${i}：员工${i}的排班需求（v2.0优化）`,
      schedulingSuggestion: `建议排班：${i}号早班（v2.0调整）`,
      annotatorComment: '',
      manualChanges: {},
      matchedRules,
      status,
      explanation,
      createdBy: '周姐'
    })
    batch2Samples.push(sample)

    store.addOperationLog({
      batchId: batch2.id,
      sampleId: sample.id,
      type: 'batch_import',
      operator: '周姐',
      operatorRole: 'annotation_lead',
      detail: `导入第 ${i} 行样本，初始状态：${status}`,
      beforeState: null,
      afterState: { status, matchedRules: matchedRules.map(r => r.code) }
    })
  }

  const sampleWithComment = batch2Samples[1]
  store.updateSample(sampleWithComment.id, {
    annotatorComment: '周姐补充：这几条是故意用旧样本编号测v2.0模型效果的，属于正常迭代，请运营复核人确认。'
  })
  store.addOperationLog({
    batchId: batch2.id,
    sampleId: sampleWithComment.id,
    type: 'add_comment',
    operator: '周姐',
    operatorRole: 'annotation_lead',
    detail: '标注负责人补充留言：这几条是故意用旧样本编号测v2.0模型效果的，属于正常迭代，请运营复核人确认。',
    beforeState: { annotatorComment: '' },
    afterState: { annotatorComment: '周姐补充：这几条是故意用旧样本编号测v2.0模型效果的，属于正常迭代，请运营复核人确认。' }
  })

  console.log(`✅ 批次2创建完成：${batch2.name}，共 ${batch2Samples.length} 条样本`)
  console.log(`   其中 ${batch2Samples.filter(s => s.status === SAMPLE_STATUS.MODEL_VERSION_CHANGED).length} 条标记为「模型版本变更待复核」`)
  console.log(`   已为 SAMPLE-0002 补充了周姐的留言示例`)

  console.log('\n🎉 样例数据初始化完成！')
  console.log('\n📋 接下来你可以：')
  console.log('   1. 启动项目：npm run dev')
  console.log('   2. 访问 http://localhost:3000')
  console.log('   3. 进入「20240607_灰度批次_v2.0」查看模型变更检测效果')
  console.log('   4. 进入「产品复盘页」看待复核列表')
  console.log('   5. 模拟运营复核人进行通过/驳回操作')
}

initSampleData()
