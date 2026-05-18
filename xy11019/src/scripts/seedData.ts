import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { Child, Guardian, PickupAuthorization, BlacklistEntry, AuthorizationStatus, PickupType, RelationType, SubmissionSource } from '../models/types';

export function seedDatabase(): void {
  dataStore.clearAll();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0];
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];

  const children: Child[] = [
    {
      id: 'child-001',
      name: 'Zhang Wei',
      chineseName: '张伟',
      birthDate: '2019-03-15',
      gender: 'male',
      classId: 'class-2024-a',
      className: '向日葵班',
      medicalNotes: '花生过敏',
      allergies: ['花生'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'child-002',
      name: 'Li Mei',
      chineseName: '李梅',
      birthDate: '2018-07-22',
      gender: 'female',
      classId: 'class-2024-b',
      className: '玫瑰班',
      allergies: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'child-003',
      name: 'Wang Hao',
      chineseName: '王浩',
      birthDate: '2019-11-08',
      gender: 'male',
      classId: 'class-2024-a',
      className: '向日葵班',
      medicalNotes: '哮喘',
      allergies: ['尘螨', '花粉'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  children.forEach(c => dataStore.addChild(c));

  const guardians: Guardian[] = [
    {
      id: 'guardian-001',
      name: 'Zhang Qiang',
      chineseName: '张强',
      phone: '13800138001',
      alternatePhone: '13900139001',
      email: 'zhangqiang@example.com',
      idCardNumber: '110101198501011234',
      relationType: RelationType.FATHER,
      isPrimary: true,
      isBlacklisted: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'guardian-002',
      name: 'Liu Ying',
      chineseName: '刘英',
      phone: '13800138002',
      email: 'liuying@example.com',
      relationType: RelationType.MOTHER,
      isPrimary: true,
      isBlacklisted: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'guardian-003',
      name: 'Zhang Guodong',
      chineseName: '张国栋',
      phone: '13800138003',
      relationType: RelationType.GRANDFATHER,
      isPrimary: false,
      isBlacklisted: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'guardian-004',
      name: 'Zhao Hong',
      chineseName: '赵红',
      phone: '13800138004',
      relationType: RelationType.GRANDMOTHER,
      isPrimary: false,
      isBlacklisted: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'guardian-005',
      name: 'Chen Ming',
      chineseName: '陈明',
      phone: '13800138005',
      relationType: RelationType.OTHER,
      isPrimary: false,
      isBlacklisted: true,
      blacklistReason: '多次迟到且未提前通知，态度恶劣',
      blacklistedAt: now.toISOString(),
      blacklistedBy: 'admin',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ];

  guardians.forEach(g => dataStore.addGuardian(g));

  const blacklistEntry: BlacklistEntry = {
    id: 'blacklist-001',
    guardianId: 'guardian-005',
    guardianName: 'Chen Ming',
    reason: '多次迟到且未提前通知，态度恶劣',
    effectiveDate: today,
    isPermanent: true,
    reportedBy: 'admin',
    reportedAt: now.toISOString(),
    createdAt: now.toISOString()
  };

  dataStore.addBlacklistEntry(blacklistEntry);

  const authorizations: PickupAuthorization[] = [
    {
      id: 'auth-001',
      childId: 'child-001',
      childName: 'Zhang Wei',
      guardianId: 'guardian-001',
      guardianName: 'Zhang Qiang',
      pickupType: PickupType.PARENT,
      relationType: RelationType.FATHER,
      effectiveStartDate: today,
      effectiveEndDate: nextMonth,
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '17:00',
      endTime: '18:00',
      status: AuthorizationStatus.APPROVED,
      statusHistory: [
        {
          fromStatus: AuthorizationStatus.DRAFT,
          toStatus: AuthorizationStatus.PENDING_REVIEW,
          changedAt: now.toISOString(),
          changedBy: 'parent-001',
          reason: '提交审批'
        },
        {
          fromStatus: AuthorizationStatus.PENDING_REVIEW,
          toStatus: AuthorizationStatus.APPROVED,
          changedAt: now.toISOString(),
          changedBy: 'admin',
          reason: '信息审核通过'
        }
      ],
      notes: '父亲常规接送',
      emergencyContactName: '刘英',
      emergencyContactPhone: '13800138002',
      idVerificationRequired: true,
      photoVerified: true,
      submissionSource: SubmissionSource.WEB_PORTAL,
      submittedAt: now.toISOString(),
      submittedBy: 'parent-001',
      reviewedAt: now.toISOString(),
      reviewedBy: 'admin',
      reviewNotes: '身份信息已验证',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'auth-002',
      childId: 'child-001',
      childName: 'Zhang Wei',
      guardianId: 'guardian-003',
      guardianName: 'Zhang Guodong',
      pickupType: PickupType.TEMPORARY,
      relationType: RelationType.GRANDFATHER,
      effectiveStartDate: today,
      effectiveEndDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      daysOfWeek: [2, 4],
      startTime: '16:30',
      endTime: '17:30',
      status: AuthorizationStatus.PENDING_REVIEW,
      statusHistory: [
        {
          fromStatus: AuthorizationStatus.DRAFT,
          toStatus: AuthorizationStatus.PENDING_REVIEW,
          changedAt: now.toISOString(),
          changedBy: 'parent-001',
          reason: '临时委托爷爷接送'
        }
      ],
      notes: '父母出差，临时委托爷爷接送3天',
      emergencyContactName: '张强',
      emergencyContactPhone: '13800138001',
      idVerificationRequired: true,
      photoVerified: false,
      submissionSource: SubmissionSource.MOBILE_APP,
      submittedAt: now.toISOString(),
      submittedBy: 'parent-001',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'auth-003',
      childId: 'child-002',
      childName: 'Li Mei',
      guardianId: 'guardian-002',
      guardianName: 'Liu Ying',
      pickupType: PickupType.PARENT,
      relationType: RelationType.MOTHER,
      effectiveStartDate: lastMonth,
      effectiveEndDate: today,
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '17:00',
      endTime: '18:00',
      status: AuthorizationStatus.EXPIRED,
      statusHistory: [
        {
          fromStatus: AuthorizationStatus.DRAFT,
          toStatus: AuthorizationStatus.PENDING_REVIEW,
          changedAt: lastMonth,
          changedBy: 'parent-002',
          reason: '提交审批'
        },
        {
          fromStatus: AuthorizationStatus.PENDING_REVIEW,
          toStatus: AuthorizationStatus.APPROVED,
          changedAt: lastMonth,
          changedBy: 'admin',
          reason: '信息审核通过'
        },
        {
          fromStatus: AuthorizationStatus.APPROVED,
          toStatus: AuthorizationStatus.EXPIRED,
          changedAt: today,
          changedBy: 'system',
          reason: '授权自动过期'
        }
      ],
      notes: '母亲常规接送（已过期）',
      emergencyContactName: '李明',
      emergencyContactPhone: '13800138999',
      idVerificationRequired: true,
      photoVerified: true,
      submissionSource: SubmissionSource.WEB_PORTAL,
      submittedAt: lastMonth,
      submittedBy: 'parent-002',
      reviewedAt: lastMonth,
      reviewedBy: 'admin',
      reviewNotes: '身份信息已验证',
      createdAt: lastMonth,
      updatedAt: now.toISOString()
    },
    {
      id: 'auth-004',
      childId: 'child-003',
      childName: 'Wang Hao',
      guardianId: 'guardian-004',
      guardianName: 'Zhao Hong',
      pickupType: PickupType.GRANDPARENT,
      relationType: RelationType.GRANDMOTHER,
      effectiveStartDate: today,
      effectiveEndDate: nextMonth,
      daysOfWeek: [1, 3, 5],
      startTime: '16:30',
      endTime: '17:30',
      status: AuthorizationStatus.APPROVED,
      statusHistory: [
        {
          fromStatus: AuthorizationStatus.DRAFT,
          toStatus: AuthorizationStatus.PENDING_REVIEW,
          changedAt: now.toISOString(),
          changedBy: 'parent-003',
          reason: '提交审批'
        },
        {
          fromStatus: AuthorizationStatus.PENDING_REVIEW,
          toStatus: AuthorizationStatus.APPROVED,
          changedAt: now.toISOString(),
          changedBy: 'admin',
          reason: '信息审核通过'
        }
      ],
      notes: '奶奶常规接送（周一、三、五）',
      emergencyContactName: '王军',
      emergencyContactPhone: '13800138888',
      idVerificationRequired: true,
      photoVerified: true,
      submissionSource: SubmissionSource.DESKTOP,
      submittedAt: now.toISOString(),
      submittedBy: 'parent-003',
      reviewedAt: now.toISOString(),
      reviewedBy: 'admin',
      reviewNotes: '身份信息已验证，注意哮喘急救药',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: 'auth-005',
      childId: 'child-002',
      childName: 'Li Mei',
      guardianId: 'guardian-005',
      guardianName: 'Chen Ming',
      pickupType: PickupType.DESIGNATED_PERSON,
      relationType: RelationType.OTHER,
      effectiveStartDate: lastMonth,
      effectiveEndDate: nextMonth,
      daysOfWeek: [2, 4],
      startTime: '17:00',
      endTime: '18:00',
      status: AuthorizationStatus.SUSPENDED,
      statusHistory: [
        {
          fromStatus: AuthorizationStatus.DRAFT,
          toStatus: AuthorizationStatus.PENDING_REVIEW,
          changedAt: lastMonth,
          changedBy: 'parent-002',
          reason: '委托朋友接送'
        },
        {
          fromStatus: AuthorizationStatus.PENDING_REVIEW,
          toStatus: AuthorizationStatus.APPROVED,
          changedAt: lastMonth,
          changedBy: 'admin',
          reason: '信息审核通过'
        },
        {
          fromStatus: AuthorizationStatus.APPROVED,
          toStatus: AuthorizationStatus.SUSPENDED,
          changedAt: now.toISOString(),
          changedBy: 'admin',
          reason: '该接送人已被列入黑名单'
        }
      ],
      notes: '朋友临时接送（已暂停，因接送人被列入黑名单）',
      emergencyContactName: '刘英',
      emergencyContactPhone: '13800138002',
      idVerificationRequired: true,
      photoVerified: false,
      submissionSource: SubmissionSource.MOBILE_APP,
      submittedAt: lastMonth,
      submittedBy: 'parent-002',
      reviewedAt: now.toISOString(),
      reviewedBy: 'admin',
      reviewNotes: '因接送人被列入黑名单，授权已暂停',
      createdAt: lastMonth,
      updatedAt: now.toISOString()
    }
  ];

  authorizations.forEach(a => dataStore.addAuthorization(a));

  console.log('=== 数据种子初始化完成 ===');
  console.log(`儿童: ${children.length} 条`);
  console.log(`接送人: ${guardians.length} 条`);
  console.log(`黑名单: ${dataStore.getBlacklist().length} 条`);
  console.log(`授权记录: ${authorizations.length} 条`);
  console.log(`  - 已批准: ${authorizations.filter(a => a.status === AuthorizationStatus.APPROVED).length}`);
  console.log(`  - 待审批: ${authorizations.filter(a => a.status === AuthorizationStatus.PENDING_REVIEW).length}`);
  console.log(`  - 已过期: ${authorizations.filter(a => a.status === AuthorizationStatus.EXPIRED).length}`);
  console.log(`  - 已暂停: ${authorizations.filter(a => a.status === AuthorizationStatus.SUSPENDED).length}`);
  console.log('==========================');
}

if (require.main === module) {
  seedDatabase();
  console.log('数据种子脚本执行完成');
  process.exit(0);
}
