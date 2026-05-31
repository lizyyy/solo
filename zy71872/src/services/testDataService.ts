import type { Team, Material, Submission } from '../types';
import { generateId } from '../utils/hash';

export function generateTestTeams(): Team[] {
  return [
    {
      id: 'team_alpha',
      name: 'Alpha 队',
      members: ['张三', '李四', '王五'],
      registrationTime: Date.now() - 3600000,
      submissionCount: 1,
    },
    {
      id: 'team_beta',
      name: 'Beta 队',
      members: ['赵六', '钱七'],
      registrationTime: Date.now() - 3500000,
      submissionCount: 2,
    },
    {
      id: 'team_gamma',
      name: 'Gamma 队',
      members: ['孙八', '周九', '吴十', '郑十一'],
      registrationTime: Date.now() - 3400000,
      submissionCount: 1,
    },
    {
      id: 'team_delta',
      name: 'Delta 队',
      members: ['冯十二', '陈十三'],
      registrationTime: Date.now() - 3300000,
      submissionCount: 1,
    },
    {
      id: 'team_epsilon',
      name: 'Epsilon 队',
      members: ['褚十四', '卫十五', '蒋十六'],
      registrationTime: Date.now() - 3200000,
      submissionCount: 1,
    },
  ];
}

export function generateTestMaterials(): Record<string, Material[]> {
  return {
    team_alpha: [
      {
        type: 'param_draft',
        name: '参数草稿_v1.txt',
        status: 'approved',
        hasIssue: false,
      },
      {
        type: 'team_notes',
        name: '队员分工笔记.md',
        status: 'approved',
        hasIssue: false,
      },
      {
        type: 'result_chart',
        name: '性能测试结果.png',
        status: 'approved',
        hasIssue: false,
      },
    ],
    team_beta: [
      {
        type: 'param_draft',
        name: '参数草稿_v2.txt',
        status: 'pending',
        hasIssue: true,
        issueDesc: '草稿被李教练修改过，未通知原作者',
      },
      {
        type: 'result_chart',
        name: '结果图_最终版.png',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'result_chart',
        name: '结果图_最终版.png',
        status: 'pending',
        hasIssue: true,
        issueDesc: '重复上传，文件名相同但内容可能不同',
      },
      {
        type: 'boundary_doc',
        name: '边界情况说明.pdf',
        status: 'pending',
        hasIssue: false,
      },
    ],
    team_gamma: [
      {
        type: 'param_draft',
        name: '参数配置_final.txt',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'team_notes',
        name: '协作笔记.md',
        status: 'pending',
        hasIssue: true,
        issueDesc: '缺少第三模块的分工说明',
      },
      {
        type: 'result_chart',
        name: '基准测试图表.png',
        status: 'pending',
        hasIssue: false,
      },
    ],
    team_delta: [
      {
        type: 'param_draft',
        name: '参数草稿.txt',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'team_notes',
        name: '队员笔记.md',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'result_chart',
        name: '测试结果.png',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'boundary_doc',
        name: '边缘测试案例.pdf',
        status: 'pending',
        hasIssue: false,
      },
    ],
    team_epsilon: [
      {
        type: 'param_draft',
        name: '配置参数_v3.txt',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'team_notes',
        name: '分工记录.md',
        status: 'pending',
        hasIssue: false,
      },
      {
        type: 'result_chart',
        name: '性能对比图.png',
        status: 'pending',
        hasIssue: false,
      },
    ],
  };
}

export function generateTestSubmissions(teams: Team[], materialsMap: Record<string, Material[]>): Submission[] {
  const now = Date.now();
  const submissions: Submission[] = [];

  teams.forEach((team, index) => {
    const materials = materialsMap[team.id] || [];
    const baseTime = now - 300000 + index * 15000;

    const submission: Submission = {
      id: generateId('sub'),
      teamId: team.id,
      teamName: team.name,
      materials,
      status: 'queued',
      anomalies: [],
      windowId: null,
      startTime: baseTime,
      isResubmission: team.id === 'team_beta',
      originalSubmissionId: team.id === 'team_beta' ? 'sub_prev_beta_001' : undefined,
    };

    submissions.push(submission);
  });

  return submissions;
}

export function generateDefaultDraftContent(teamName: string): string {
  return `# ${teamName} - 参数草稿

## 基本配置
- 窗口数量: 3
- 处理超时: 30000ms
- 自动检测异常: 开启
- 保留历史记录: 开启

## 调度策略
- 策略: 最短队列优先
- 优先级: 按注册时间排序

## 验证规则
- 必须包含参数草稿 ✓
- 必须包含队员笔记 ✓
- 必须包含结果图 ✓
- 允许边界情况说明

## 修改记录
- v1: 初始版本
`;
}

export function importTestData(): {
  teams: Team[];
  materialsMap: Record<string, Material[]>;
  submissions: Submission[];
} {
  const teams = generateTestTeams();
  const materialsMap = generateTestMaterials();
  const submissions = generateTestSubmissions(teams, materialsMap);
  return { teams, materialsMap, submissions };
}
