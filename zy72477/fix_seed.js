const fs = require('fs');
let content = fs.readFileSync('src/seed.ts', 'utf8');

// 1. 在第一中学避难点的 reviewRedLine 后添加 updateRedLineRemarks
content = content.replace(
  "workflowService.reviewRedLine(result1.redLine.id, 'reviewed', '已审核，容量数据合理', '老马');\n    }",
  "workflowService.reviewRedLine(result1.redLine.id, 'reviewed', '已审核，容量数据合理', '老马');\n      workflowService.updateRedLineRemarks(result1.redLine.id, '该避难点为学校操场，可用面积约1200平方米，容量：600人。东侧入口道路施工已完成，可正常通行', '规划科-小李');\n    }"
);

// 2. 在社区活动中心避难点逻辑之后，添加实验小学和市民广场的额外操作
const extraCode = `
  const extraShelter1 = createdShelters[3];
  const wf4 = workflowService.getWorkflowForShelter(extraShelter1.id);
  if (wf4) {
    const result4 = workflowService.step1_importRedLine(
      wf4.id,
      extraShelter1.id,
      'v1.0',
      '实验小学教学楼及操场，容量约800人',
      '东至南京东路、西至浙江中路、南至教学楼、北至操场围墙',
      '2026-01-02',
      '规划科-小王'
    );
    if (result4.redLine) {
      workflowService.reviewRedLine(result4.redLine.id, 'reviewed', '已审核，范围清晰', '老马');
    }
    console.log(\`  已为 \${extraShelter1.name} 导入红线图\`);
  }

  const extraShelter2 = createdShelters[4];
  const wf5 = workflowService.getWorkflowForShelter(extraShelter2.id);
  if (wf5) {
    workflowService.step1_importRedLine(
      wf5.id,
      extraShelter2.id,
      'v1.0',
      '市民广场地下空间，设计容量3000人',
      '世纪大道1000号市民广场全域',
      '2026-01-03',
      '规划科-小王'
    );
    console.log(\`  已为 \${extraShelter2.name} 导入红线图\`);
  }
`;

content = content.replace(
  "  capacityCheckService.calculateAll('system_init');",
  extraCode + "\n  capacityCheckService.calculateAll('system_init');"
);

fs.writeFileSync('src/seed.ts', content);
console.log('seed.ts updated successfully');
