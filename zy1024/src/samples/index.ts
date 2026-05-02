import { GitChange } from '../types';

export interface SampleDataset {
  key: string;
  name: string;
  description: string;
  changes: GitChange[];
  sampleConfig: string;
}

export const sampleDatasets: SampleDataset[] = [
  {
    key: 'frontend-backend',
    name: '前后端混合改动',
    description: '一个典型的全栈项目改动，包含前端组件、后端 API、数据库迁移和配置文件',
    changes: [
      {
        filePath: 'src/components/UserProfile.tsx',
        changeType: 'modified',
        isBinary: false,
        insertions: 42,
        deletions: 15,
        diffContent: `diff --git a/src/components/UserProfile.tsx b/src/components/UserProfile.tsx
index abc123..def456 100644
--- a/src/components/UserProfile.tsx
+++ b/src/components/UserProfile.tsx
@@ -1,5 +1,10 @@
 import React, { useState, useEffect } from 'react';
+import { useAuth } from '../hooks/useAuth';
+import { BillingInfo } from './BillingInfo';
 
 export function UserProfile() {
+  const { user } = useAuth();
+  const [showBilling, setShowBilling] = useState(false);
+
   const [profile, setProfile] = useState(null);
 
   useEffect(() => {`
      },
      {
        filePath: 'src/hooks/useAuth.ts',
        changeType: 'modified',
        isBinary: false,
        insertions: 28,
        deletions: 5,
        diffContent: `diff --git a/src/hooks/useAuth.ts b/src/hooks/useAuth.ts
index 123abc..456def 100644
--- a/src/hooks/useAuth.ts
+++ b/src/hooks/useAuth.ts
@@ -10,6 +10,15 @@ export function useAuth() {
   const login = async (credentials: LoginParams) => {
     const response = await api.post('/auth/login', credentials);
+    if (response.data.requiresMFA) {
+      setMFAChallenge(response.data.mfaToken);
+      return { requiresMFA: true };
+    }
     setToken(response.data.token);
     setUser(response.data.user);
+    localStorage.setItem('user', JSON.stringify(response.data.user));
+    return { success: true };
   };`
      },
      {
        filePath: 'backend/api/users.py',
        changeType: 'modified',
        isBinary: false,
        insertions: 35,
        deletions: 8,
        diffContent: `diff --git a/backend/api/users.py b/backend/api/users.py
index a1b2c3..d4e5f6 100644
--- a/backend/api/users.py
+++ b/backend/api/users.py
@@ -45,6 +45,18 @@ def update_user(user_id: int):
     if not current_user.can_edit(user_id):
         raise PermissionError("Not authorized")
     
+    # 验证邮箱唯一性
+    if 'email' in data:
+        existing = User.query.filter(
+            User.email == data['email'],
+            User.id != user_id
+        ).first()
+        if existing:
+            return jsonify({
+                'error': 'EMAIL_ALREADY_EXISTS',
+                'message': '该邮箱已被其他用户使用'
+            }), 400
+
     user.update(data)
     db.session.commit()
     return jsonify(user.to_dict())`
      },
      {
        filePath: 'backend/db/migrations/20240315_add_mfa_columns.sql',
        changeType: 'added',
        isBinary: false,
        insertions: 25,
        deletions: 0,
        diffContent: `-- Create MFA related columns
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN mfa_method VARCHAR(20) DEFAULT 'totp';

-- Create backup codes table
CREATE TABLE user_backup_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code_hash VARCHAR(128) NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_codes_user_id ON user_backup_codes(user_id);`
      },
      {
        filePath: 'src/components/BillingInfo.tsx',
        changeType: 'added',
        isBinary: false,
        insertions: 120,
        deletions: 0,
      },
      {
        filePath: 'config/staging.env',
        changeType: 'modified',
        isBinary: false,
        insertions: 3,
        deletions: 1,
        diffContent: `diff --git a/config/staging.env b/config/staging.env
index 111aaa..222bbb 100644
--- a/config/staging.env
+++ b/config/staging.env
@@ -5,6 +5,8 @@ DATABASE_URL=postgresql://staging:***@db.staging.example.com/app
 REDIS_URL=redis://redis.staging.example.com:6379
 API_BASE_URL=https://api.staging.example.com
 PAYMENT_GATEWAY_KEY=pk_test_xxxxxx
+MFA_ISSUER=MyApp (Staging)
+ENABLE_MFA=true

-LOG_LEVEL=info
+LOG_LEVEL=debug`
      },
      {
        filePath: 'src/assets/logo.png',
        changeType: 'modified',
        isBinary: true,
        insertions: 0,
        deletions: 0,
      },
      {
        filePath: 'tests/e2e/user-profile.spec.ts',
        changeType: 'added',
        isBinary: false,
        insertions: 85,
        deletions: 0,
      },
    ],
    sampleConfig: `version: '1.0'
projectName: my-fullstack-app

modules:
  - name: frontend
    paths:
      - 'src/**/*.tsx'
      - 'src/**/*.ts'
      - 'src/components/**/*'
      - 'src/hooks/**/*'
      - 'src/assets/**/*'
    owners:
      - 'frontend-team'
      - 'alice'
    defaultCheckCommands:
      - 'npm run test:frontend'
      - 'npm run lint:frontend'
      - 'npm run typecheck'
    riskLevel: medium

  - name: backend
    paths:
      - 'backend/**/*.py'
      - 'backend/api/**/*'
      - 'backend/services/**/*'
    owners:
      - 'backend-team'
      - 'bob'
    defaultCheckCommands:
      - 'pytest backend/'
      - 'flake8 backend/'
    riskLevel: high

  - name: database
    paths:
      - 'backend/db/migrations/**/*'
      - 'backend/db/*.sql'
    owners:
      - 'dba-team'
      - 'charlie'
    defaultCheckCommands:
      - 'sqitch verify'
      - 'psql -f migrations/...'
    riskLevel: critical

  - name: config
    paths:
      - 'config/**/*'
      - '*.env'
      - '.env.*'
    owners:
      - 'devops-team'
    defaultCheckCommands:
      - 'envsubst --validate config/*.env'
    riskLevel: high

  - name: tests
    paths:
      - 'tests/**/*'
      - '*.spec.ts'
      - '*.test.ts'
    owners:
      - 'qa-team'
    defaultCheckCommands:
      - 'npm run test'
    riskLevel: low

rules:
  - id: auth-changes
    name: 认证相关改动
    description: 涉及用户认证、授权、MFA 等安全相关的改动
    keywords:
      - 'auth'
      - 'login'
      - 'password'
      - 'MFA'
      - '2FA'
      - 'token'
      - 'jwt'
      - 'permission'
    paths:
      - '**/*auth*'
      - '**/hooks/useAuth*'
    riskLevel: critical
    blockingLevel: required
    checkCommands:
      - 'npm run test:auth'
      - 'pytest tests/test_auth.py'
      - 'npm run security:scan'
    confirmations:
      - '确认认证逻辑变更不会影响现有用户登录'
      - '确认 MFA 功能已在测试环境验证'

  - id: billing-changes
    name: 计费相关改动
    description: 涉及支付、计费、订阅等财务相关的改动
    keywords:
      - 'billing'
      - 'payment'
      - 'subscription'
      - 'invoice'
      - 'stripe'
    paths:
      - '**/*billing*'
      - '**/*payment*'
    riskLevel: critical
    blockingLevel: required
    checkCommands:
      - 'npm run test:billing'
      - 'pytest tests/test_billing.py'
    confirmations:
      - '确认计费逻辑变更已与财务团队同步'
      - '确认 Stripe Webhook 处理逻辑正确'

  - id: db-migrations
    name: 数据库迁移
    description: 数据库 schema 变更，需要特别注意回滚和数据一致性
    fileTypes:
      - '.sql'
    paths:
      - '**/migrations/**/*'
    riskLevel: critical
    blockingLevel: required
    checkCommands:
      - 'sqitch verify'
      - 'psql -1 -f migrations/*.sql'
    confirmations:
      - '确认迁移脚本有对应的回滚脚本'
      - '确认大数据表的变更已考虑锁表风险'
      - '确认 DBA 团队已审核迁移脚本'

  - id: config-env
    name: 环境配置变更
    description: 环境变量或配置文件变更
    paths:
      - '*.env'
      - '.env.*'
      - 'config/**/*'
    riskLevel: high
    blockingLevel: recommended
    checkCommands:
      - 'envsubst --no-symlink config/*.env'
      - 'diff config/prod.env config/staging.env'
    confirmations:
      - '确认敏感配置（密码、密钥）没有提交到代码库'
      - '确认生产环境配置值正确，没有混用测试环境值'

  - id: e2e-tests
    name: 端到端测试
    description: E2E 测试文件变更
    paths:
      - 'tests/e2e/**/*'
      - '**/*.spec.ts'
    riskLevel: low
    blockingLevel: optional
    checkCommands:
      - 'npm run test:e2e'
    confirmations: []

globalCheckCommands:
  - 'npm run lint'
  - 'npm run typecheck'

defaultRiskLevel: medium
`
  },
  {
    key: 'mobile-only',
    name: '纯移动端项目改动',
    description: 'React Native 或 Flutter 项目的典型改动',
    changes: [
      {
        filePath: 'lib/screens/home_screen.dart',
        changeType: 'modified',
        isBinary: false,
        insertions: 50,
        deletions: 20,
      },
      {
        filePath: 'ios/Podfile.lock',
        changeType: 'modified',
        isBinary: false,
        insertions: 15,
        deletions: 10,
      },
      {
        filePath: 'android/app/build.gradle',
        changeType: 'modified',
        isBinary: false,
        insertions: 5,
        deletions: 2,
      },
      {
        filePath: 'assets/images/icon.png',
        changeType: 'added',
        isBinary: true,
        insertions: 0,
        deletions: 0,
      },
    ],
    sampleConfig: `version: '1.0'
projectName: flutter-mobile-app

modules:
  - name: flutter-app
    paths:
      - 'lib/**/*.dart'
      - 'lib/**/*.dart'
    owners:
      - 'mobile-team'
    defaultCheckCommands:
      - 'flutter test'
      - 'flutter analyze'
    riskLevel: medium

  - name: ios-native
    paths:
      - 'ios/**/*'
      - 'ios/Podfile*'
    owners:
      - 'ios-team'
    defaultCheckCommands:
      - 'cd ios && pod install && xcodebuild -scheme Runner test'
    riskLevel: high

  - name: android-native
    paths:
      - 'android/**/*'
      - 'android/build.gradle'
      - 'android/app/build.gradle'
    owners:
      - 'android-team'
    defaultCheckCommands:
      - 'cd android && ./gradlew test'
    riskLevel: high

rules:
  - id: native-deps
    name: 原生依赖变更
    description: iOS Podfile 或 Android Gradle 依赖变更
    paths:
      - 'ios/Podfile*'
      - 'android/**/*.gradle'
    riskLevel: high
    blockingLevel: recommended
    checkCommands:
      - 'cd ios && pod deintegrate && pod install'
      - 'cd android && ./gradlew clean build'
    confirmations:
      - '确认依赖版本变更已在 CI 上验证'

  - id: assets
    name: 资源文件变更
    fileTypes:
      - '.png'
      - '.jpg'
      - '.jpeg'
      - '.svg'
      - '.ttf'
    riskLevel: low
    blockingLevel: optional
    checkCommands: []
    confirmations: []

globalCheckCommands:
  - 'flutter format lib/'

defaultRiskLevel: medium
`
  }
];

export function getSampleDataset(key: string): SampleDataset | undefined {
  return sampleDatasets.find(ds => ds.key === key);
}

export function listSampleDatasets(): Array<{ key: string; name: string; description: string }> {
  return sampleDatasets.map(ds => ({
    key: ds.key,
    name: ds.name,
    description: ds.description,
  }));
}
