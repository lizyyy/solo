<script setup lang="ts">
</script>

<template>
  <div class="card">
    <div class="card-title">📖 使用指南</div>

    <div class="guide-section">
      <h4>📝 声部长备注样例格式</h4>
      <p>建议声部长按照以下格式填写备注，方便系统自动识别：</p>
      <ul>
        <li><strong>文件名:</strong> 声部长备注-[声部]-[姓名].csv</li>
        <li><strong>必填列:</strong> 学生姓名、乐器、声部、曲目</li>
        <li><strong>可选列:</strong> 小节、状态、备注</li>
      </ul>
      <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 6px; font-family: monospace; font-size: 12px;">
        学生姓名,乐器,声部,曲目,小节,备注<br/>
        张三,二胡,一声部,二泉映月,1-32,第15小节需确认节奏<br/>
        李四,古筝,二声部,高山流水,1-64,转调部分已核对
      </div>
    </div>

    <div class="guide-section">
      <h4>⚠️ 小节错位在哪里查看？</h4>
      <p>小节错位等问题会显示在以下位置：</p>
      <ol>
        <li><strong>记录列表的"待处理原因"列</strong> - 可直接看到问题描述</li>
        <li><strong>筛选"待处理"状态</strong> - 快速过滤所有需要确认的记录</li>
        <li><strong>历史记录弹窗</strong> - 点击📜按钮查看完整修改轨迹</li>
      </ol>
      <p style="margin-top: 8px;">
        <span class="badge badge-info">💡 提示</span>
        黄色背景的行表示重复记录，红色背景表示待处理，可通过批量操作快速处理。
      </p>
    </div>

    <div class="guide-section">
      <h4>✅ 导出排练小结前的复核步骤</h4>
      <ol>
        <li><strong>筛选"待处理"记录</strong> - 确保所有问题都已处理</li>
        <li><strong>检查"重复"记录</strong> - 确认重复导入的记录是否需要保留或删除</li>
        <li><strong>核对统计数字</strong> - 顶部统计栏显示总记录、待处理、已确认、重复数量</li>
        <li><strong>点击"导出排练小结"</strong> - 自动生成包含待处理事项、重复核对、确认清单的文本文件</li>
      </ol>
    </div>

    <div class="guide-section">
      <h4>🔄 关于重复记录的口径说明</h4>
      <p>系统判断重复的规则：<strong>同一学生 + 同一曲目 = 重复</strong></p>
      <ul>
        <li>重复导入时，系统会自动标记为"重复"状态，并记录来源</li>
        <li>删除一条重复记录后，若只剩一条，会自动解除重复标记</li>
        <li>批量导入时，重复的记录会统计在结果中，不会越跑越多</li>
      </ul>
    </div>

    <div class="guide-section" style="background: #e7f5ff; border-left-color: #4dabf7;">
      <h4 style="color: #1971c2;">💡 快捷操作提示</h4>
      <ul style="color: #1864ab;">
        <li>复选框可多选，配合"批量确认/驳回"快速处理</li>
        <li>撤回操作：查看历史记录后可手动恢复到之前的状态</li>
        <li>导出时会自动使用当前筛选条件，或导出选中的记录</li>
      </ul>
    </div>
  </div>
</template>
