"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allSubmissions = exports.problematicSubmission = exports.normalSubmissions = void 0;
exports.normalSubmissions = [
    {
        id: 'SUB-2024-001',
        department: '技术研发部',
        courseName: '企业级微服务架构实践',
        courseCode: 'TRAIN-TECH-001',
        traineeName: '张三',
        traineeId: 'EMP-10001',
        submitTime: '2024-05-10T09:30:00+08:00',
        status: 'submitted',
        completionRate: 100,
        quizScore: 92,
        practicalScore: 88,
        totalScore: 90,
        earlyTermination: false,
        attachments: [
            {
                id: 'ATT-001',
                name: '微服务架构设计报告.pdf',
                type: 'application/pdf',
                url: '/attachments/ATT-001.pdf',
                uploadTime: '2024-05-10T09:28:00+08:00'
            },
            {
                id: 'ATT-002',
                name: '代码实现仓库链接.md',
                type: 'text/markdown',
                url: '/attachments/ATT-002.md',
                uploadTime: '2024-05-10T09:29:00+08:00'
            }
        ],
        auditTrail: [
            {
                id: 'AUDIT-001',
                action: '创建提交',
                operator: '张三',
                operatorId: 'EMP-10001',
                timestamp: '2024-05-08T14:20:00+08:00',
                fromStatus: 'draft',
                toStatus: 'draft'
            },
            {
                id: 'AUDIT-002',
                action: '提交审核',
                operator: '张三',
                operatorId: 'EMP-10001',
                timestamp: '2024-05-10T09:30:00+08:00',
                fromStatus: 'draft',
                toStatus: 'submitted'
            }
        ]
    },
    {
        id: 'SUB-2024-002',
        department: '市场营销部',
        courseName: '数字化营销数据分析',
        courseCode: 'TRAIN-MKT-003',
        traineeName: '李四',
        traineeId: 'EMP-10002',
        submitTime: '2024-05-11T14:45:00+08:00',
        status: 'submitted',
        completionRate: 100,
        quizScore: 85,
        practicalScore: 90,
        totalScore: 87,
        earlyTermination: false,
        attachments: [
            {
                id: 'ATT-003',
                name: '营销数据分析报告.xlsx',
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                url: '/attachments/ATT-003.xlsx',
                uploadTime: '2024-05-11T14:40:00+08:00'
            },
            {
                id: 'ATT-004',
                name: '可视化图表截图.png',
                type: 'image/png',
                url: '/attachments/ATT-004.png',
                uploadTime: '2024-05-11T14:43:00+08:00'
            }
        ],
        auditTrail: [
            {
                id: 'AUDIT-003',
                action: '创建提交',
                operator: '李四',
                operatorId: 'EMP-10002',
                timestamp: '2024-05-09T10:15:00+08:00',
                fromStatus: 'draft',
                toStatus: 'draft'
            },
            {
                id: 'AUDIT-004',
                action: '提交审核',
                operator: '李四',
                operatorId: 'EMP-10002',
                timestamp: '2024-05-11T14:45:00+08:00',
                fromStatus: 'draft',
                toStatus: 'submitted'
            }
        ]
    },
    {
        id: 'SUB-2024-003',
        department: '人力资源部',
        courseName: '新员工入职培训体系建设',
        courseCode: 'TRAIN-HR-002',
        traineeName: '王五',
        traineeId: 'EMP-10003',
        submitTime: '2024-05-12T16:20:00+08:00',
        status: 'submitted',
        completionRate: 100,
        quizScore: 95,
        practicalScore: 92,
        totalScore: 93,
        earlyTermination: false,
        attachments: [
            {
                id: 'ATT-005',
                name: '入职培训体系方案.docx',
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                url: '/attachments/ATT-005.docx',
                uploadTime: '2024-05-12T16:18:00+08:00'
            }
        ],
        auditTrail: [
            {
                id: 'AUDIT-005',
                action: '创建提交',
                operator: '王五',
                operatorId: 'EMP-10003',
                timestamp: '2024-05-10T11:30:00+08:00',
                fromStatus: 'draft',
                toStatus: 'draft'
            },
            {
                id: 'AUDIT-006',
                action: '提交审核',
                operator: '王五',
                operatorId: 'EMP-10003',
                timestamp: '2024-05-12T16:20:00+08:00',
                fromStatus: 'draft',
                toStatus: 'submitted'
            }
        ]
    }
];
exports.problematicSubmission = {
    id: 'SUB-2024-004',
    department: '运营管理部',
    courseName: '供应链风险管理与控制',
    courseCode: 'TRAIN-OPS-005',
    traineeName: '赵六',
    traineeId: 'EMP-10004',
    submitTime: '2024-05-13T11:00:00+08:00',
    status: 'early_terminated',
    completionRate: 65,
    quizScore: 45,
    practicalScore: null,
    totalScore: null,
    earlyTermination: true,
    terminationReason: '学员主动申请提前结束',
    attachments: [
        {
            id: 'ATT-006',
            name: '提前结束申请.pdf',
            type: 'application/pdf',
            url: '/attachments/ATT-006.pdf',
            uploadTime: '2024-05-13T10:55:00+08:00'
        }
    ],
    auditTrail: [
        {
            id: 'AUDIT-007',
            action: '创建提交',
            operator: '赵六',
            operatorId: 'EMP-10004',
            timestamp: '2024-05-11T09:00:00+08:00',
            fromStatus: 'draft',
            toStatus: 'draft'
        },
        {
            id: 'AUDIT-008',
            action: '提交中期报告',
            operator: '赵六',
            operatorId: 'EMP-10004',
            timestamp: '2024-05-12T15:30:00+08:00',
            fromStatus: 'draft',
            toStatus: 'under_review'
        },
        {
            id: 'AUDIT-009',
            action: '申请提前结束',
            operator: '赵六',
            operatorId: 'EMP-10004',
            timestamp: '2024-05-13T11:00:00+08:00',
            fromStatus: 'under_review',
            toStatus: 'early_terminated'
        }
    ]
};
exports.allSubmissions = [...exports.normalSubmissions, exports.problematicSubmission];
