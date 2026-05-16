# S3 Bucket 策略审计报告

生成时间: 2026/5/17 06:33:00
分析文件: test-policy.json

## 执行摘要

| 指标 | 值 |
|------|----|
| 原始语句数 | 4 |
| 压缩后语句数 | 3 |
| 压缩率 | 25.0% |
| 发现问题数 | 5 |

## 问题详细列表

### 🚨 严重 (Critical)

#### 语句 #2 - overly_broad

- 字段: Resource
- 值: `*`
- 描述: 资源权限过宽，匹配所有bucket: *
- 建议: 强烈建议限制到具体的bucket

### 🔴 高 (High)

#### 语句 #2 - overly_broad

- 字段: Action
- 值: `s3:*`
- 描述: 动作权限过宽: s3:*
- 建议: 建议使用更具体的动作，如 s3:GetObject

### ⚠️ 中 (Medium)

#### 语句 #0 - overly_broad

- 字段: Resource
- 值: `arn:aws:s3:::my-bucket/*`
- 描述: 资源路径使用过宽通配符: arn:aws:s3:::my-bucket/*
- 建议: 建议限制到具体的前缀或对象

#### 语句 #1 - overly_broad

- 字段: Resource
- 值: `arn:aws:s3:::my-bucket/*`
- 描述: 资源路径使用过宽通配符: arn:aws:s3:::my-bucket/*
- 建议: 建议限制到具体的前缀或对象

#### 语句 #3 - overly_broad

- 字段: Resource
- 值: `arn:aws:s3:::public-bucket/*`
- 描述: 资源路径使用过宽通配符: arn:aws:s3:::public-bucket/*
- 建议: 建议限制到具体的前缀或对象

## 合并操作明细

### 合并 #1

- 合并语句: #1, #0
- 合并原因: 主体、效果、条件相同，合并动作和资源

## 压缩后策略

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/bob"
      },
      "Action": "s3:*",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/alice"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/charlie"
      },
      "Action": [
        "s3:ListBucket",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::public-bucket",
        "arn:aws:s3:::public-bucket/*"
      ]
    }
  ]
}
```

---
*此报告由 S3 Policy Compactor 工具自动生成*