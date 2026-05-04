# PHP Security Scanner

一个功能全面的 PHP 项目安全扫描 CLI 工具，用于在上线前检测老 PHP 项目中的安全漏洞。

## 功能特性

- **多维度扫描**: 代码安全、模板安全、配置安全、上传安全、依赖安全、路由安全
- **真实风险检测**: 不只是简单的关键词 grep，而是基于上下文分析的风险识别
- **详细报告**: 包含严重级别、文件路径、行号、证据片段、可信度、原因解释和修复建议
- **基线管理**: 支持创建和维护 baseline，抑制已确认的历史问题
- **多种报告格式**: 支持 Markdown、JSON 和 SARIF 格式导出
- **灵活配置**: 通过 YAML 配置文件自定义扫描规则

## 支持的检测规则

| 类别 | 检测内容 |
|------|----------|
| **代码安全** | 危险函数调用 (eval/assert/system/exec)、SQL 注入、弱密码哈希、调试代码暴露 |
| **模板安全** | Twig `raw` 过滤器、Blade `{!! !!}` 未转义输出、PHP 模板直接输出用户输入 |
| **配置安全** | .env 硬编码密码/密钥、PHP.ini 不安全配置、敏感配置泄漏 |
| **上传安全** | 上传目录中的危险扩展名文件、.htaccess 恶意配置、上传处理缺少白名单验证 |
| **依赖安全** | Composer 依赖包高危版本检测、废弃包、不稳定版本 |
| **路由安全** | 缺少 CSRF 保护、缺少认证中间件、未约束的路由参数 |

## 安装

### 方式一: 全局安装 (推荐)

```bash
git clone <repository-url> php-security-scanner
cd php-security-scanner
composer install
```

然后将 `bin/scansec` 添加到 PATH 或创建别名:

```bash
alias scansec='/path/to/php-security-scanner/bin/scansec'
```

### 方式二: 作为项目依赖

```json
{
    "require-dev": {
        "php-security-scanner/cli": "dev-main"
    }
}
```

## 快速开始

### 完整命令链

```bash
# 1. 进入目标项目目录
cd /path/to/your/php-project

# 2. 初始化安全扫描配置
scansec init

# 3. 执行完整安全扫描
scansec scan

# 4. 审计依赖包漏洞
scansec audit-deps

# 5. 创建 baseline (可选，用于抑制历史问题)
scansec baseline create

# 6. 导出多种格式的报告
scansec report --format=all --output=./security-reports
```

## 命令详解

### init - 初始化配置

在项目中创建默认的 `security-rules.yaml` 配置文件。

```bash
# 在当前目录初始化
scansec init

# 指定项目路径
scansec init --path=/path/to/project

# 覆盖已存在的配置
scansec init --force
```

配置文件示例:

```yaml
rules:
  dangerous_functions:
    enabled: true
    severity: critical
    functions: ['eval', 'assert', 'system', 'exec']
  
  sql_injection:
    enabled: true
    severity: critical
    
  xss_template:
    enabled: true
    severity: high

directories:
  - src/
  - controllers/
  - templates/

excludes:
  - vendor/
  - node_modules/
  - .git/
```

### scan - 执行安全扫描

执行完整的安全扫描，包括代码、模板、配置、路由等。

```bash
# 扫描当前目录
scansec scan

# 指定项目路径
scansec scan --path=/path/to/project

# 不应用 baseline (显示所有问题)
scansec scan --no-baseline

# 仅显示指定严重级别
scansec scan --severity=critical

# 仅使用指定扫描器
scansec scan --scanners=php,template

# 输出格式
scansec scan --output=json    # JSON 格式
scansec scan --output=compact # 简洁格式
scansec scan --output=table   # 表格格式 (默认)
```

扫描输出示例:

```
PHP 安全扫描
============

扫描路径: /path/to/project
正在扫描...

扫描结果摘要
+----------+------+
| 严重级别 | 数量 |
+----------+------+
| Critical | 3    |
| High     | 5    |
| Medium   | 8    |
| Low      | 2    |
| Info     | 1    |
+----------+------+
| 总计     | 19   |
+----------+------+

详细发现
========

🔴 Critical (3)
----------------

1. dangerous_function_eval
   文件: controllers/UserController.php:45
   可信度: high
   类别: code_security
   证据: 调用了危险函数: eval()
   
   问题: eval() 执行任意 PHP 代码，可能导致远程代码执行 (RCE)
   修复: 使用数据处理替代 eval，或使用白名单严格限制输入
   
   代码片段:
      43:     public function executeCode()
      44:     {
   >> 45:         eval($_GET['code']);
      46:     }
```

### audit-deps - 审计依赖安全

检查 Composer 依赖包的已知安全漏洞。

```bash
# 审计当前项目的依赖
scansec audit-deps

# 指定路径
scansec audit-deps --path=/path/to/project

# 包含开发依赖
scansec audit-deps --include-dev

# 仅显示高危问题
scansec audit-deps --severity=critical,high
```

检测内容:
- 已知 CVE 漏洞的依赖版本
- 已废弃 (abandoned) 的包
- 不稳定版本 (dev-master, alpha, beta)
- 通配符版本约束 (`*`, `dev-master`)
- 禁用 secure-http 配置

### baseline - 基线管理

创建和维护扫描基线，用于抑制已确认的历史问题。

```bash
# 查看基线状态
scansec baseline status

# 创建基线 (执行扫描并保存所有发现为基线)
scansec baseline create

# 更新基线
scansec baseline update
scansec baseline update --add-new      # 添加新发现的问题
scansec baseline update --keep-missing # 保留已不存在的问题

# 列出基线中的所有抑制项
scansec baseline list

# 清除基线
scansec baseline clear
```

基线工作流程:

```bash
# 首次扫描发现 15 个问题
scansec scan

# 创建基线，将这 15 个问题标记为"已接受"
scansec baseline create

# 后续扫描只会报告新问题
scansec scan  # 只显示基线创建后新增的问题

# 开发人员修复问题后，更新基线
scansec baseline update
```

### report - 生成报告

导出多种格式的安全报告。

```bash
# 生成 Markdown 报告
scansec report --format=markdown

# 生成 JSON 报告
scansec report --format=json

# 生成 SARIF 报告 (用于 GitHub Code Scanning)
scansec report --format=sarif

# 生成所有格式
scansec report --format=all

# 指定输出目录
scansec report --format=all --output=./security-reports

# 指定项目名称
scansec report --project-name="My PHP App"

# 不应用基线 (包含所有问题)
scansec report --no-baseline
```

报告格式说明:

| 格式 | 用途 |
|------|------|
| **Markdown** | 人工阅读、邮件分享、文档归档 |
| **JSON** | 程序处理、自定义分析、数据集成 |
| **SARIF** | GitHub Code Scanning、DevOps 流水线集成 |

## 样例项目

### 漏洞样例项目 (`examples/vulnerable-project`)

包含各种常见安全漏洞的测试项目，用于验证扫描器功能。

**包含的漏洞类型**:

```
├── composer.json          # 高危依赖版本、禁用 secure-http
├── .env.example           # 硬编码密码、密钥、调试模式开启
├── routes.php             # 未约束路由参数、缺少 CSRF
├── controllers/
│   ├── UserController.php # eval、system、exec、SQL拼接、MD5、var_dump
│   └── UploadController.php # 无白名单验证、黑名单绕过
├── templates/
│   ├── profile.twig       # |raw 过滤器、直接访问 $_GET
│   ├── dashboard.blade.php # {!! !!} 未转义
│   └── search.php         # 直接 echo $_GET
├── public/uploads/
│   ├── malicious.php      # Webshell
│   ├── shell.phtml        # 备选扩展名
│   └── .htaccess          # AddHandler php5-script
└── config/
    └── php.ini            # display_errors=On, error_reporting=E_ALL
```

### 安全样例项目 (`examples/secure-project`)

遵循安全最佳实践的参考项目。

**安全特性**:

```
├── composer.json          # 稳定版本、secure-http=true
├── .env.example           # 环境变量占位符
├── routes/web.php         # 参数约束、中间件保护
├── controllers/
│   ├── UserController.php # PDO 预处理语句、password_hash
│   └── UploadController.php # MIME 白名单、扩展名白名单、内容验证
└── templates/
    ├── profile.twig       # 自动转义
    └── dashboard.blade.php # {{ }} 转义输出
```

## 检测规则详解

### 危险函数检测

| 函数 | 风险 | 严重级别 |
|------|------|----------|
| `eval()` | RCE | Critical |
| `assert()` | RCE | Critical |
| `system()` | 命令注入 | Critical |
| `exec()` | 命令注入 | Critical |
| `shell_exec()` | 命令注入 | Critical |
| `passthru()` | 命令注入 | Critical |
| `unserialize()` | 对象注入 | High |
| `extract()` | 变量覆盖 | Medium |
| `parse_str()` | 变量覆盖 | Medium |

### SQL 注入检测

检测模式:
- 字符串拼接 SQL: `"SELECT * FROM users WHERE id = " . $id`
- 直接传入查询: `$pdo->query($_GET['sql'])`
- 缺少预处理: 未使用 `prepare()` + `execute()`

### XSS 模板检测

Twig:
- `{{ var|raw }}` - 禁用转义
- `{{ $_GET['x'] }}` - 直接访问超全局

Blade:
- `{!! $var !!}` - 不转义输出
- `{{ request('x') }}` - 直接访问请求

PHP 模板:
- `echo $_GET['x']` - 直接输出
- `<?= $_GET['x'] ?>` - 短标签输出
- `htmlspecialchars_decode()` - 还原转义

### 弱密码哈希检测

| 函数 | 风险 |
|------|------|
| `md5()` | 已破解 |
| `sha1()` | 已破解 |
| `crypt()` 配合 MD5 盐 | 强度不足 |

**推荐做法**:
```php
// 安全的密码哈希
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

// 验证
if (password_verify($password, $hash)) {
    // 验证成功
}
```

### 上传安全检测

危险扩展名:
- `.php`, `.php5`, `.php7`, `.phtml`, `.phar`
- `.asp`, `.aspx`, `.jsp`
- `.pl`, `.cgi`, `.sh`
- `.htaccess`, `.ini`

危险的 .htaccess 配置:
- `AddHandler php5-script .php`
- `SetHandler application/x-httpd-php`

**安全的上传验证**:
```php
// 1. 扩展名白名单
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];

// 2. MIME 类型验证
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($tmpName);

// 3. 内容验证 (图片)
if (!imagecreatefromjpeg($tmpName)) {
    throw new Exception('Invalid image');
}

// 4. 重命名文件
$newName = bin2hex(random_bytes(16)) . '.' . $ext;
```

## 在 CI/CD 中使用

### GitHub Actions

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.1'
          
      - name: Checkout Security Scanner
        uses: actions/checkout@v3
        with:
          repository: php-security-scanner/cli
          path: security-scanner
          
      - name: Install Scanner
        run: cd security-scanner && composer install
        
      - name: Run Security Scan
        run: php security-scanner/bin/scansec scan --path=.
        
      - name: Generate SARIF Report
        if: always()
        run: php security-scanner/bin/scansec report --format=sarif --output=security-results.sarif
        
      - name: Upload SARIF to GitHub
        if: always()
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: security-results.sarif
```

### GitLab CI/CD

```yaml
security_scan:
  stage: test
  image: php:8.1-cli
  
  before_script:
    - apt-get update && apt-get install -y git unzip
    - curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
    - git clone https://github.com/php-security-scanner/cli.git /security-scanner
    - cd /security-scanner && composer install
    
  script:
    - cd $CI_PROJECT_DIR
    - php /security-scanner/bin/scansec scan --path=.
    - php /security-scanner/bin/scansec report --format=all --output=security-reports
    
  artifacts:
    paths:
      - security-reports/
    when: always
    expire_in: 30 days
```

## 测试

运行测试套件:

```bash
# 运行所有测试
composer test

# 或使用 PHPUnit 直接运行
./vendor/bin/phpunit

# 运行特定测试类
./vendor/bin/phpunit tests/FindingTest.php
./vendor/bin/phpunit tests/ScannerIntegrationTest.php
```

测试覆盖:
- `FindingTest.php` - 扫描结果对象测试
- `ConfigTest.php` - 配置管理测试
- `BaselineManagerTest.php` - 基线管理测试
- `ReportGeneratorTest.php` - 报告生成测试
- `ScannerIntegrationTest.php` - 扫描器集成测试 (使用样例项目)

## 坏输入样例

测试扫描器时可以使用以下恶意输入:

### 代码注入

```php
// 危险代码示例
eval($_GET['code']);
assert($_GET['assertion']);
system('ping -c 4 ' . $_GET['host']);
exec('ls ' . $_POST['dir']);
shell_exec('grep ' . $_GET['pattern']);
```

### SQL 注入

```php
// 危险 SQL 示例
$sql = "SELECT * FROM users WHERE id = " . $_GET['id'];
$pdo->query($sql);

$name = $_POST['name'];
$sql = "INSERT INTO users (name) VALUES ('$name')";
$mysqli->query($sql);
```

### XSS

```twig
{# Twig 危险示例 #}
{{ user.input|raw }}
{{ app.request.get('content') }}
{{ $_GET['message'] }}
```

```blade
{{-- Blade 危险示例 --}}
{!! $user->bio !!}
{!! request('message') !!}
```

```php
// PHP 模板危险示例
echo $_GET['q'];
print $_POST['comment'];
<?= $_GET['message'] ?>
```

### 上传绕过

```
文件名绕过:
- shell.php.jpg (双扩展名)
- shell.php%00.jpg (空字节)
- shell.phtml (备选扩展名)

.htaccess 攻击:
AddHandler php5-script .jpg
SetHandler application/x-httpd-php
```

## 注意事项

1. **误报**: 扫描器可能产生误报，特别是:
   - 字符串中包含的危险函数名 (如 `$evalFunction`)
   - 白名单内的 `eval` 调用
   - 已转义的输出

2. **漏报**: 扫描器可能无法检测:
   - 复杂的代码混淆
   - 动态函数调用 (`$func()`)
   - 反射 API 调用
   - 存储型 XSS (需要运行时分析)

3. **依赖审计**: 本工具使用内置漏洞数据库，建议同时使用:
   - `composer audit` (Composer 官方)
   - SensioLabs Security Checker
   - GitHub Dependabot

4. **基线使用**:
   - 仅抑制已理解并接受的风险
   - 定期审查基线中的抑制项
   - 不要把 baseline 当作忽略安全问题的方式

## 与其他工具对比

| 特性 | 本工具 | phpcs-security-audit | Psalm | PHPStan |
|------|--------|----------------------|-------|---------|
| 危险函数检测 | ✅ | ✅ | ✅ | ✅ |
| SQL 注入检测 | ✅ | ✅ | 部分 | 部分 |
| XSS 模板检测 | ✅ | ❌ | ❌ | ❌ |
| 依赖审计 | ✅ | ❌ | ❌ | ❌ |
| 配置检测 | ✅ | ❌ | ❌ | ❌ |
| 上传安全 | ✅ | ❌ | ❌ | ❌ |
| Baseline | ✅ | ❌ | ✅ | ✅ |
| SARIF 输出 | ✅ | ❌ | 部分 | 部分 |
| 专注安全 | ✅ | ✅ | 部分 | 部分 |

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License

---

**免责声明**: 本工具仅供安全审计使用，请勿用于非法用途。使用本工具扫描您没有权限的系统可能违反法律。
