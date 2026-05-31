import type {
  DirectorySnapshot,
  ChecksumManifest,
  FailureLog,
  RollbackRecord,
} from '@/types';

export const MOCK_SNAPSHOT: DirectorySnapshot = {
  path: '/data/backup/srv-prod-01',
  timestamp: '2026-05-30T02:15:00Z',
  files: [
    { name: 'db_main_20260530.tar.gz', path: '/data/backup/srv-prod-01/db_main_20260530.tar.gz', size: 2147483648, modified: '2026-05-30T02:10:00Z', checksum: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' },
    { name: 'app_config_20260530.tar.gz', path: '/data/backup/srv-prod-01/app_config_20260530.tar.gz', size: 5242880, modified: '2026-05-30T02:05:00Z', checksum: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3' },
    { name: 'user_data_20260530.tar.gz', path: '/data/backup/srv-prod-01/user_data_20260530.tar.gz', size: 5368709120, modified: '2026-05-30T02:20:00Z', checksum: '11112222333344445555666677778888' },
    { name: 'log_archive_20260530.tar.gz', path: '/data/backup/srv-prod-01/log_archive_20260530.tar.gz', size: 1073741824, modified: '2026-05-30T02:12:00Z', checksum: 'aaaabbbbccccddddeeeeffffaaaabbbb' },
    { name: 'certs_20260530.tar.gz', path: '/data/backup/srv-prod-01/certs_20260530.tar.gz', size: 1048576, modified: '2026-05-30T02:03:00Z', checksum: 'deadbeefdeadbeefdeadbeefdeadbeef' },
    { name: 'db_replica_20260530.tar.gz', path: '/data/backup/srv-prod-01/db_replica_20260530.tar.gz', size: 3221225472, modified: '2026-05-30T02:18:00Z', checksum: 'b1b2b3b4b5b6b7b8b9b0c1c2c3c4c5c6' },
    { name: 'db_main_20260530_v2.tar.gz', path: '/data/backup/srv-prod-01/db_main_20260530_v2.tar.gz', size: 2147483648, modified: '2026-05-30T04:10:00Z', checksum: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' },
    { name: 'misc data 20260530.tar.gz', path: '/data/backup/srv-prod-01/misc data 20260530.tar.gz', size: 268435456, modified: '2026-05-30T02:08:00Z', checksum: '99998888777766665555444433332222' },
  ],
};

export const MOCK_CHECKSUM: ChecksumManifest = {
  entries: [
    { path: '/data/backup/srv-prod-01/db_main_20260530.tar.gz', algorithm: 'md5', expected: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', actual: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', match: true },
    { path: '/data/backup/srv-prod-01/app_config_20260530.tar.gz', algorithm: 'md5', expected: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3', actual: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3', match: true },
    { path: '/data/backup/srv-prod-01/user_data_20260530.tar.gz', algorithm: 'md5', expected: '11112222333344445555666677778888', actual: '00000000000000000000000000000000', match: false },
    { path: '/data/backup/srv-prod-01/log_archive_20260530.tar.gz', algorithm: 'md5', expected: 'aaaabbbbccccddddeeeeffffaaaabbbb', actual: 'aaaabbbbccccddddeeeeffffaaaabbbb', match: true },
    { path: '/data/backup/srv-prod-01/certs_20260530.tar.gz', algorithm: 'md5', expected: 'deadbeefdeadbeefdeadbeefdeadbeef', actual: 'deadbeefdeadbeefdeadbeefdeadbeef', match: true },
    { path: '/data/backup/srv-prod-01/db_replica_20260530.tar.gz', algorithm: 'md5', expected: 'b1b2b3b4b5b6b7b8b9b0c1c2c3c4c5c6', actual: 'b1b2b3b4b5b6b7b8b9b0c1c2c3c4c5c6', match: true },
    { path: '/data/backup/srv-prod-01/cron_backup_20260530.tar.gz', algorithm: 'md5', expected: '1234abcd5678ef901234abcd5678ef90', actual: undefined, match: false },
  ],
};

export const MOCK_FAILURE_LOG: FailureLog = {
  entries: [
    { timestamp: '2026-05-30T02:20:15Z', level: 'ERROR', message: 'user_data_20260530.tar.gz: 校验值不匹配 expected=11112222333344445555666677778888 actual=00000000000000000000000000000000', source: 'backup-verify.sh', path: '/data/backup/srv-prod-01/user_data_20260530.tar.gz' },
    { timestamp: '2026-05-30T02:25:00Z', level: 'ERROR', message: 'cron_backup_20260530.tar.gz: 文件不存在，备份任务可能未执行', source: 'backup-cron.sh', path: '/data/backup/srv-prod-01/cron_backup_20260530.tar.gz' },
    { timestamp: '2026-05-30T03:00:00Z', level: 'WARN', message: '检测到同日重复备份: db_main_20260530_v2.tar.gz (02:10) 与 db_main_20260530.tar.gz (04:10)', source: 'backup-monitor.sh' },
    { timestamp: '2026-05-30T03:30:00Z', level: 'WARN', message: '路径含空格: /data/backup/srv-prod-01/misc data 20260530.tar.gz，可能影响自动化脚本', source: 'backup-scan.sh', path: '/data/backup/srv-prod-01/misc data 20260530.tar.gz' },
    { timestamp: '2026-05-30T04:15:00Z', level: 'ERROR', message: 'app_config_20260530.tar.gz: 回滚操作完成，但校验值仍为回滚前值', source: 'backup-rollback.sh', path: '/data/backup/srv-prod-01/app_config_20260530.tar.gz' },
    { timestamp: '2026-05-30T02:10:00Z', level: 'INFO', message: 'db_main_20260530.tar.gz: 备份完成，大小 2.0GB，校验通过', source: 'backup-main.sh', path: '/data/backup/srv-prod-01/db_main_20260530.tar.gz' },
  ],
};

export const MOCK_ROLLBACK: RollbackRecord = {
  entries: [
    {
      timestamp: '2026-05-30T04:00:00Z',
      targetPath: '/data/backup/srv-prod-01/app_config_20260530.tar.gz',
      reason: '配置文件版本错误，需回退至上一版本',
      preChecksum: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3',
      postChecksum: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3',
      completed: true,
    },
    {
      timestamp: '2026-05-30T03:45:00Z',
      targetPath: '/data/backup/srv-prod-01/certs_20260530.tar.gz',
      reason: '证书备份触发误报，无需实际回滚',
      preChecksum: 'deadbeefdeadbeefdeadbeefdeadbeef',
      postChecksum: 'deadbeefdeadbeefdeadbeefdeadbeef',
      completed: true,
    },
  ],
};

export const MOCK_PREVIOUS_HISTORY = {
  machineId: 'srv-prod-01',
  records: [
    {
      machineId: 'srv-prod-01',
      verificationDate: '2026-05-23T10:00:00Z',
      issues: [
        {
          id: 'prev-001',
          type: 'missing_file' as const,
          severity: 'needs_backup' as const,
          path: '/data/backup/srv-prod-01/cron_backup_20260523.tar.gz',
          description: 'cron备份包缺失，连续第二周未生成',
          detail: { expectedPath: '/data/backup/srv-prod-01/cron_backup_20260523.tar.gz' },
          relatedLogSnippet: '[2026-05-23T02:25:00Z] ERROR: cron_backup_20260523.tar.gz: 文件不存在',
          timestamp: '2026-05-23T10:00:00Z',
        },
        {
          id: 'prev-002',
          type: 'path_with_spaces' as const,
          severity: 'ignorable' as const,
          path: '/data/backup/srv-prod-01/misc data 20260523.tar.gz',
          description: '路径含空格，建议重命名',
          detail: { actualPath: '/data/backup/srv-prod-01/misc data 20260523.tar.gz' },
          timestamp: '2026-05-23T10:00:00Z',
        },
      ],
      resolvedIssueIds: ['prev-002'],
    },
  ],
};
