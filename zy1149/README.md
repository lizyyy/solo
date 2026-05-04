# DeployFlow - PHP 项目打包发布流程管理工具

一个用于管理老 PHP 业务站点打包发布流程的命令行工具，解决上线前手动操作带来的漏文件、扩展不一致、迁移顺序错误等问题。

## 功能特性

- **多命令支持**: init、validate、build、plan、release、rollback、report
- **全面校验**: Composer 平台约束、PHP 扩展、环境变量、目录权限、敏感配置、迁移脚本
- **打包构建**: 生成 tar/zip 产物、manifest.json、checksums.txt
- **发布计划**: 步骤依赖、阻断项、人工确认、审计记录
- **回滚管理**: 检测不可逆迁移、生成回滚清单
- **多格式报告**: Markdown、JSON、CSV

## 环境要求

- PHP >= 8.0
- PHP 扩展: json, zip, pcre, hash
- Composer

## 安装

### 方式一: 从源码安装

```bash
# 克隆项目
git clone <repository-url>
cd deployflow

# 安装依赖
php composer.phar install

# 验证安装
php bin/deployflow --version
```

### 方式二: 全局安装

```bash
# 在项目中添加依赖
composer require deployflow/deployflow

# 使用
vendor/bin/deployflow
```

## 快速开始

### 1. 初始化示例项目

创建一个完整的可测试示例项目：

```bash
# 创建测试目录
mkdir my-project && cd my-project

# 使用 --seed 选项创建完整的示例项目
php /path/to/deployflow/bin/deployflow init --seed
```

创建的文件结构：
```
my-project/
├── release.yaml          # 主配置文件
├── deploy-targets.json   # 发布目标配置
├── env-matrix.csv        # 环境变量矩阵
├── composer.json         # PHP 项目依赖
├── composer.lock         # 依赖锁文件
├── public/
│   └── index.php         # 入口文件
├── config/
│   ├── app.php           # 应用配置
│   └── database.php      # 数据库配置
├── src/
│   ├── Controller/
│   │   └── HomeController.php
│   └── Service/
│       └── UserService.php
└── migrations/           # 数据库迁移
    ├── 20240101000000_CreateUsersTable.php
    ├── 20240102000000_AddUserEmailIndex.php
    └── 20240103000000_CreateOrdersTable.sql
```

### 2. 验证项目配置

```bash
php /path/to/deployflow/bin/deployflow validate
```

输出示例：
```
 [OK] All validations passed!

 Validation Summary:
 ------------ ------- 
  Category     Count  
 ------------ ------- 
  composer     3      
  extensions   1      
  env          2      
  permissions  1      
  sensitive    1      
  migrations   2      
  targets      1      
  total        11     
 ------------ ------- 
```

### 3. 构建发布包

```bash
php /path/to/deployflow/bin/deployflow build
```

输出目录结构：
```
output/
├── release-1.0.0-20240115-120000/
│   ├── release-1.0.0.tar          # 打包产物
│   ├── release-1.0.0.tar.gz       # 压缩包
│   ├── manifest.json               # 清单文件
│   └── checksums.txt               # 校验和
└── latest/                          # 最新版本软链接
```

### 4. 生成发布计划

```bash
php /path/to/deployflow/bin/deployflow plan
```

输出示例：
```
 Release Plan
 ==============

 Version: 1.0.0
 Status: Ready
 Target: production

 Release Steps:
 ===============

 [1/6] ✅ [Validation] validate_composer
      Description: Validate composer.json and composer.lock
      Priority: High
      Dependencies: None

 [2/6] ✅ [Validation] validate_extensions
      Description: Check required PHP extensions
      Priority: Critical
      Dependencies: validate_composer

 [3/6] ✅ [Pre-Deploy] backup_current
      Description: Backup current release before deployment
      Priority: High
      Dependencies: validate_extensions

 [4/6] ✅ [Migration] run_migrations
      Description: Execute database migrations
      Priority: High
      Dependencies: backup_current
      ⚠️  Requires confirmation

 [5/6] ✅ [Deploy] deploy_files
      Description: Deploy files to target
      Priority: Critical
      Dependencies: run_migrations

 [6/6] ✅ [Post-Deploy] clear_cache
      Description: Clear application cache
      Priority: Medium
      Dependencies: deploy_files

 Progress: 6/6 (100%)
```

### 5. 执行发布

```bash
# 执行发布（需要人工确认）
php /path/to/deployflow/bin/deployflow release

# 或使用 --no-interaction 自动执行
php /path/to/deployflow/bin/deployflow release --no-interaction
```

### 6. 生成发布报告

```bash
# 生成所有格式的报告
php /path/to/deployflow/bin/deployflow report

# 指定格式
php /path/to/deployflow/bin/deployflow report --format=json
php /path/to/deployflow/bin/deployflow report --format=csv
php /path/to/deployflow/bin/deployflow report --format=markdown
```

输出文件：
```
reports/
├── release-report-20240115-120000.md
├── release-report-20240115-120000.json
└── release-report-20240115-120000.csv
```

## 测试异常链路

项目内置了一个坏样例（bad-sample），包含各种有意的错误，用于测试校验功能：

```bash
# 创建坏样例
mkdir bad-project && cd bad-project
php /path/to/deployflow/bin/deployflow init --bad-sample

# 进入坏样例目录
cd bad-sample

# 运行验证（会检测到多个问题）
php /path/to/deployflow/bin/deployflow validate
```

预期输出（检测到的问题）：

```
 [ERROR] Validation failed with blockers!

 Blockers Found:
 ================

 1. [extensions] Missing required PHP extension: ext-pdo
    File: composer.json

 2. [sensitive] Hardcoded password found in: config/database.php
    Context: {"line":7,"pattern":"password.*=.*['\"][^'\"]{8,}"}

 3. [migrations] Irreversible migration: 003_DropTable.sql
    Context: {"type":"sql","contains_drop":true}

 4. [migrations] Invalid dependency: nonexistent_migration.php
    File: migrations/002_AddColumn.php

 5. [permissions] World-writable directory is insecure: public/
    Context: {"permissions":"0777","recommended":"0755"}

 Warnings:
 =========

 1. [composer] PHP version constraint (>=7.0) is below recommended minimum (>=8.0)

 2. [env] Production environment missing from env matrix

 Validation Summary:
 ------------ ------- 
  Category     Count  
 ------------ ------- 
  blockers     5      
  errors       0      
  warnings     2      
  infos        6      
  total        13     
 ------------ ------- 
```

## 命令详解

### init - 初始化项目

```bash
# 基本初始化（仅配置文件）
deployflow init

# 创建完整的示例项目
deployflow init --seed

# 创建坏样例（用于测试校验）
deployflow init --bad-sample

# 强制覆盖已有文件
deployflow init --force
```

### validate - 验证项目

验证所有配置和代码：

```bash
# 完整验证
deployflow validate

# 仅验证特定类别
deployflow validate --category=composer
deployflow validate --category=extensions
deployflow validate --category=migrations
```

验证项：
| 类别 | 说明 |
|------|------|
| composer | 检查 composer.json/lock 的平台约束 |
| extensions | 检查必需的 PHP 扩展是否加载 |
| env | 比较各环境变量差异 |
| permissions | 检查目录权限安全性 |
| sensitive | 检测硬编码的密钥和密码 |
| migrations | 检查迁移脚本顺序、依赖、可逆性 |
| targets | 验证发布目标配置 |

### build - 构建发布包

```bash
# 使用默认配置构建
deployflow build

# 指定版本号
deployflow build --version=1.2.3

# 指定输出格式 (tar 或 zip)
deployflow build --format=zip
deployflow build --format=tar

# 自定义输出目录
deployflow build --output-dir=/path/to/releases
```

输出文件说明：

| 文件 | 说明 |
|------|------|
| manifest.json | 包含版本、时间戳、文件清单、校验和 |
| checksums.txt | 所有文件的 SHA256 校验和 |
| release-{version}.tar | 未压缩的 tar 包 |
| release-{version}.tar.gz | Gzip 压缩的 tar 包 |

manifest.json 示例：
```json
{
  "version": "1.0.0",
  "build_timestamp": "2024-01-15T12:00:00+00:00",
  "total_files": 42,
  "total_size": 1048576,
  "files": [
    {"path": "public/index.php", "size": 256, "checksum": "abc123..."},
    ...
  ],
  "checksum": "sha256:..."
}
```

### plan - 生成发布计划

```bash
# 生成默认计划
deployflow plan

# 指定目标环境
deployflow plan --target=staging

# 指定版本
deployflow plan --version=1.2.3

# 详细模式
deployflow plan -vvv
```

### release - 执行发布

```bash
# 交互式执行
deployflow release

# 自动执行（无交互）
deployflow release --no-interaction

# 使用已有计划文件
deployflow release --plan=output/latest/release-plan.json
```

### rollback - 回滚管理

```bash
# 准备回滚计划
deployflow rollback --version=1.0.0

# 生成回滚包
deployflow rollback --version=1.0.0 --create-package

# 列出可用的回滚版本
deployflow rollback --list
```

回滚检测项：
- 检测不可逆的迁移（如 DROP TABLE）
- 检查是否有回滚方法（down() 函数）
- 生成回滚步骤清单

### report - 生成报告

```bash
# 生成所有格式
deployflow report

# 指定格式
deployflow report --format=json
deployflow report --format=csv
deployflow report --format=markdown

# 使用自定义模板
deployflow report --template=/path/to/template.md
```

## 配置文件格式

### release.yaml - 主配置文件

```yaml
project:
  name: my-php-project
  version: 1.0.0
  description: My PHP Application

build:
  output_format: tar           # tar 或 zip
  include:
    - public/
    - config/
    - src/
    - vendor/
  exclude:
    - .git/
    - .env
    - node_modules/
    - tests/

deploy:
  default_target: production
  backup_before_deploy: true
  maintenance_mode: true
  clear_cache: true

validation:
  check_composer_platform: true
  check_php_extensions: true
  check_env_differences: true
  check_directory_permissions: true
  check_sensitive_configs: true
  check_migration_order: true

migrations:
  directory: migrations
  run_before_deploy: false
  require_manual_confirmation: true

rollback:
  enabled: true
  keep_releases: 5
  auto_backup: true

reporting:
  formats: [markdown, json]
  include_changes: true
  include_validations: true
```

### deploy-targets.json - 发布目标配置

```json
{
  "targets": {
    "development": {
      "name": "development",
      "type": "server",
      "environment": "dev",
      "php_version": "8.0",
      "php_extensions": ["json", "pdo", "pdo_mysql", "mbstring"],
      "deploy_path": "/var/www/html",
      "webserver_user": "www-data",
      "maintenance_enabled": false,
      "backup_enabled": false
    },
    "staging": {
      "name": "staging",
      "php_version": "8.0",
      "php_extensions": ["json", "pdo", "pdo_mysql", "mbstring", "opcache"],
      "deploy_path": "/var/www/app",
      "maintenance_enabled": true,
      "backup_enabled": true
    },
    "production": {
      "name": "production",
      "php_version": "8.0",
      "php_extensions": ["json", "pdo", "pdo_mysql", "mbstring", "opcache", "redis"],
      "deploy_path": "/var/www/prod",
      "maintenance_enabled": true,
      "backup_enabled": true
    }
  }
}
```

### env-matrix.csv - 环境变量矩阵

```csv
variable,development,staging,production
APP_ENV,dev,staging,prod
APP_DEBUG,true,false,false
APP_URL,http://dev.example.com,https://staging.example.com,https://www.example.com
DB_HOST,localhost,staging-db.internal,prod-db.internal
DB_PORT,3306,3306,3306
DB_NAME,app_dev,app_staging,app_prod
DB_USER,dev_user,staging_user,prod_user
DB_PASS,dev_secret,staging_secret,prod_secret
```

### composer.json 平台配置

```json
{
  "require": {
    "php": ">=8.0",
    "ext-json": "*",
    "ext-pdo": "*",
    "ext-pdo_mysql": "*",
    "ext-mbstring": "*"
  },
  "config": {
    "platform": {
      "php": "8.0.30"
    }
  }
}
```

### 迁移脚本格式

PHP 迁移脚本（支持 up/down）：
```php
<?php

/**
 * @description Create users table
 * @dependsOn None  # 或依赖的迁移文件名
 */
class CreateUsersTable
{
    public function up(): void
    {
        // 执行迁移
    }

    public function down(): void
    {
        // 回滚迁移
    }
}
```

SQL 迁移脚本：
```sql
-- @description Create orders table
-- @dependsOn 20240101000000_CreateUsersTable.php

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ...
);
```

## 测试

### 运行单元测试

```bash
# 运行所有测试
php composer.phar test

# 或使用 PHPUnit
./vendor/bin/phpunit

# 详细输出
./vendor/bin/phpunit -v

# 代码覆盖率（需要 Xdebug）
./vendor/bin/phpunit --coverage-html=coverage-report
```

### 手动测试流程

#### 正常链路测试

```bash
# 1. 创建测试目录
mkdir test-normal && cd test-normal

# 2. 初始化示例项目
php /path/to/deployflow/bin/deployflow init --seed

# 3. 验证（应该通过）
php /path/to/deployflow/bin/deployflow validate

# 4. 构建
php /path/to/deployflow/bin/deployflow build

# 5. 检查产物
ls -la output/
cat output/latest/manifest.json
cat output/latest/checksums.txt

# 6. 生成计划
php /path/to/deployflow/bin/deployflow plan

# 7. 生成报告
php /path/to/deployflow/bin/deployflow report

# 8. 检查报告
ls -la reports/
```

#### 异常链路测试

```bash
# 1. 创建测试目录
mkdir test-bad && cd test-bad

# 2. 初始化坏样例
php /path/to/deployflow/bin/deployflow init --bad-sample

# 3. 进入坏样例目录
cd bad-sample

# 4. 验证（应该检测到多个问题）
php /path/to/deployflow/bin/deployflow validate

# 预期: 检测到 blockers 和 warnings
```

## 目录结构

```
deployflow/
├── bin/
│   └── deployflow              # CLI 入口
├── src/
│   ├── Command/                 # 命令实现
│   │   ├── InitCommand.php
│   │   ├── ValidateCommand.php
│   │   ├── BuildCommand.php
│   │   ├── PlanCommand.php
│   │   ├── ReleaseCommand.php
│   │   ├── RollbackCommand.php
│   │   └── ReportCommand.php
│   ├── Parser/                  # 配置解析器
│   │   ├── ComposerParser.php
│   │   ├── EnvMatrixParser.php
│   │   ├── MigrationParser.php
│   │   ├── ReleaseConfigParser.php
│   │   └── DeployTargetsParser.php
│   ├── Validator/               # 验证器
│   │   ├── ProjectValidator.php
│   │   └── ValidatorResult.php
│   ├── Builder/                 # 构建器
│   │   └── ProjectBuilder.php
│   ├── Release/                 # 发布相关
│   │   ├── ReleasePlanner.php
│   │   ├── ReleasePlan.php
│   │   └── ReleaseStep.php
│   ├── Rollback/                # 回滚相关
│   │   ├── RollbackManager.php
│   │   └── RollbackPlan.php
│   ├── Report/                  # 报告生成
│   │   └── ReportGenerator.php
│   ├── Config/                  # 配置
│   │   └── ProjectConfig.php
│   └── Exception/               # 异常
│       └── DeployFlowException.php
├── tests/                       # 测试文件
│   ├── Config/
│   ├── Exception/
│   ├── Release/
│   ├── Rollback/
│   └── Validator/
├── composer.json
├── phpunit.xml
└── README.md
```

## 常见问题

### Q: 如何添加自定义验证规则？

在 `src/Validator/ProjectValidator.php` 中添加新的验证方法，并在 `validate()` 方法中调用。

### Q: 如何自定义打包内容？

修改 `release.yaml` 中的 `build.include` 和 `build.exclude` 配置。

### Q: 如何处理不可逆迁移？

工具会自动检测以下情况为不可逆：
- SQL 中包含 `DROP TABLE`、`DROP DATABASE`
- PHP 迁移脚本没有 `down()` 方法
- 脚本注释标记 `@irreversible`

### Q: 支持哪些打包格式？

- `tar` - 未压缩的 tar 归档
- `zip` - Zip 压缩包
- 默认同时生成 `.tar` 和 `.tar.gz`

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
