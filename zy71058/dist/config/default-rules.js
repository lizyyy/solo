"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRules = void 0;
exports.defaultRules = [
    {
        id: 'aws-access-key',
        name: 'AWS Access Key',
        description: '检测 AWS 访问密钥 ID (AKIA 开头)',
        pattern: 'AKIA[0-9A-Z]{16}',
        severity: 'critical',
        category: 'credential',
        examples: ['AKIAIOSFODNN7EXAMPLE']
    },
    {
        id: 'aws-secret-key',
        name: 'AWS Secret Key',
        description: '检测 AWS 秘密访问密钥',
        pattern: '(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])',
        severity: 'critical',
        category: 'credential',
        examples: ['wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY']
    },
    {
        id: 'generic-api-key',
        name: 'Generic API Key',
        description: '检测通用 API 密钥格式',
        pattern: '(api[_-]?key|apikey|secret[_-]?key|token)["\']?\\s*[:=]\\s*["\']?[A-Za-z0-9-_]{16,}["\']?',
        severity: 'high',
        category: 'credential'
    },
    {
        id: 'private-key',
        name: 'Private Key',
        description: '检测 PEM 格式的私钥',
        pattern: '-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP)? ?PRIVATE KEY-----',
        severity: 'critical',
        category: 'credential'
    },
    {
        id: 'basic-auth',
        name: 'Basic Authentication',
        description: '检测 HTTP Basic 认证字符串',
        pattern: 'https?://[^:\\s]+:[^@\\s]+@[^\\s]+',
        severity: 'high',
        category: 'credential',
        examples: ['https://user:password@example.com']
    },
    {
        id: 'intranet-ip',
        name: 'Intranet IP Address',
        description: '检测内网 IP 地址 (10.x, 172.16-31.x, 192.168.x)',
        pattern: '\\b(?:10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|172\\.(?:1[6-9]|2[0-9]|3[01])\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3})\\b',
        severity: 'medium',
        category: 'network',
        examples: ['10.0.0.1', '192.168.1.100', '172.16.5.20']
    },
    {
        id: 'kubernetes-dockerconfigjson',
        name: 'Kubernetes dockerconfigjson',
        description: '检测 Kubernetes 镜像拉取密钥 (base64 编码)',
        pattern: 'eyJhdXRocyI6eyJ[^"]+',
        severity: 'high',
        category: 'credential'
    },
    {
        id: 'database-password',
        name: 'Database Password',
        description: '检测数据库密码配置',
        pattern: '(password|passwd|pwd)["\']?\\s*[:=]\\s*["\'][^"\']{6,}["\']',
        severity: 'critical',
        category: 'credential'
    },
    {
        id: 'kubernetes-secret-data',
        name: 'Kubernetes Secret Data',
        description: '检测 Kubernetes Secret 中的 base64 编码数据',
        pattern: 'data:\\s*[\\s\\S]*?[A-Za-z0-9+/]{20,}={0,2}\\s*',
        severity: 'medium',
        category: 'credential'
    },
    {
        id: 'internal-domain',
        name: 'Internal Domain',
        description: '检测常见内网域名后缀',
        pattern: '\\b(?:[a-zA-Z0-9-]+\\.)*(?:internal|corp|local|lan|svc\\.cluster\\.local)\\b',
        severity: 'low',
        category: 'network'
    },
    {
        id: 'jwt-token',
        name: 'JWT Token',
        description: '检测 JSON Web Token',
        pattern: 'eyJ[A-Za-z0-9-_]+\\.eyJ[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+',
        severity: 'high',
        category: 'credential'
    },
    {
        id: 'slack-webhook',
        name: 'Slack Webhook',
        description: '检测 Slack Webhook URL',
        pattern: 'https://hooks\\.slack\\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+',
        severity: 'high',
        category: 'credential'
    },
    {
        id: 'git-credentials',
        name: 'Git Credentials',
        description: '检测 Git 凭证 URL',
        pattern: 'https?://[^:]+:[^@]+@(?:github\\.com|gitlab\\.com|bitbucket\\.org)',
        severity: 'high',
        category: 'credential'
    },
    {
        id: 'tls-certificate',
        name: 'TLS Certificate',
        description: '检测 PEM 格式的 TLS 证书',
        pattern: '-----BEGIN CERTIFICATE-----',
        severity: 'low',
        category: 'config'
    }
];
