# 保险共保分摊账单系统

## 功能特性

- 主承保、从承保、免赔额自动分摊计算
- 比例校验（比例闭合性检查）
- 免赔额重复扣除检测
- 从承保确认状态管理
- 批量处理，正常/异常记录分离
- 状态流转：正常、补录、撤回、重复提交、待确认、异常
- 数据持久化，重启后历史记录保持一致

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 查看帮助
python -m coinsurance --help

# 加载样例数据
python -m coinsurance load-samples

# 处理所有赔案
python -m coinsurance process

# 查看账单明细
python -m coinsurance list --status normal
python -m coinsurance list --status pending
python -m coinsurance list --status exception

# 导出账单
python -m coinsurance export --output-dir ./exports

# 查看统计
python -m coinsurance stats
```

## 数据目录

数据默认存储在 `./data/` 目录下：
- `policies.json` - 保单信息
- `claims.json` - 赔案信息
- `bills.json` - 分摊账单记录
- `audit_log.json` - 操作审计日志
