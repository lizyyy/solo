# SQL 慢查询指纹分析报告

生成时间: 2026/5/17 22:37:20

## 总体统计

| 统计项 | 数值 |
|--------|------|
| 总查询数 | 12 |
| 唯一指纹数 | 10 |
| 涉及表数 | 7 |
| 总耗时 (s) | 58.79 |
| 平均耗时 (s) | 4.8993 |
| P50 耗时 (s) | 3.4567 |
| P95 耗时 (s) | 15.6789 |
| P99 耗时 (s) | 15.6789 |
| 最大耗时 (s) | 15.6789 |

## 耗时分桶

| 耗时区间 | 查询数 | 占比 | 总耗时(s) |
|----------|--------|------|------------|
| < 0.1s | 0 | 0.0% | 0.00 |
| 0.1s - 0.5s | 1 | 8.3% | 0.12 |
| 0.5s - 1s | 2 | 16.7% | 1.46 |
| 1s - 2s | 1 | 8.3% | 1.23 |
| 2s - 5s | 3 | 25.0% | 10.37 |
| 5s - 10s | 3 | 25.0% | 19.69 |
| > 10s | 2 | 16.7% | 25.91 |

## 查询类型统计

| 查询类型 | 数量 | 占比 | 总耗时(s) | 平均耗时(s) |
|----------|------|------|------------|------------|
| SELECT | 10 | 83.3% | 43.99 | 4.3989 |
| UPDATE | 1 | 8.3% | 10.23 | 10.2345 |
| DELETE | 1 | 8.3% | 4.57 | 4.5678 |

## Top 慢查询指纹

### 1. 指纹 `a5c758072d82e4eb...`

- **类型**: SELECT
- **涉及表**: logs
- **执行次数**: 1
- **总耗时**: 15.68s
- **平均耗时**: 15.6789s
- **耗时分布**: P50=15.6789s, P95=15.6789s, P99=15.6789s

#### 归一化 SQL
```sql
SELECT * FROM logs WHERE level = ? AND created_at > ? ORDER BY id DESC;
```

#### 最慢样本

1. **耗时**: 15.6789s (行 81-86)
   ```sql
   SELECT * FROM logs WHERE level = 'error' AND created_at > '2024-01-01' ORDER BY id DESC;
   ```

### 2. 指纹 `eb6eb0634396ca65...`

- **类型**: UPDATE
- **涉及表**: orders
- **执行次数**: 1
- **总耗时**: 10.23s
- **平均耗时**: 10.2345s
- **耗时分布**: P50=10.2345s, P95=10.2345s, P99=10.2345s

#### 归一化 SQL
```sql
UPDATE orders SET status = ?, updated_at = NOW() WHERE created_at < ? AND status = ?;
```

#### 最慢样本

1. **耗时**: 10.2345s (行 24-29)
   ```sql
   UPDATE orders SET status = 'completed', updated_at = NOW() WHERE created_at < '2024-01-01' AND status = 'pending';
   ```

### 3. 指纹 `331d86c528d2db78...`

- **类型**: SELECT
- **涉及表**: orders, users
- **执行次数**: 1
- **总耗时**: 7.89s
- **平均耗时**: 7.8901s
- **耗时分布**: P50=7.8901s, P95=7.8901s, P99=7.8901s

#### 归一化 SQL
```sql
SELECT o.*, u.name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.created_at BETWEEN ? AND ? LIMIT ?;
```

#### 最慢样本

1. **耗时**: 7.8901s (行 39-44)
   ```sql
   SELECT o.*, u.name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.created_at BETWEEN '2024-01-01' AND '2024-01-15' LIMIT 1000;
   ```

### 4. 指纹 `6526ff85c5a5b0cd...`

- **类型**: SELECT
- **涉及表**: products, categories
- **执行次数**: 1
- **总耗时**: 6.12s
- **平均耗时**: 6.1234s
- **耗时分布**: P50=6.1234s, P95=6.1234s, P99=6.1234s

#### 归一化 SQL
```sql
SELECT p.*, c.name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.price BETWEEN ? AND ? ORDER BY p.created_at DESC;
```

#### 最慢样本

1. **耗时**: 6.1234s (行 72-77)
   ```sql
   SELECT p.*, c.name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.price BETWEEN 50 AND 500 ORDER BY p.created_at DESC;
   ```

### 5. 指纹 `4316f5ffcf065dd6...`

- **类型**: SELECT
- **涉及表**: users, profiles
- **执行次数**: 1
- **总耗时**: 5.68s
- **平均耗时**: 5.6789s
- **耗时分布**: P50=5.6789s, P95=5.6789s, P99=5.6789s

#### 归一化 SQL
```sql
SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.id IN (...) ORDER BY u.created_at DESC;
```

#### 最慢样本

1. **耗时**: 5.6789s (行 9-14)
   ```sql
   SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.id IN (1, 2, 3, 4, 5) ORDER BY u.created_at DESC;
   ```

### 6. 指纹 `8035d3134e7528a3...`

- **类型**: DELETE
- **涉及表**: session_tokens
- **执行次数**: 1
- **总耗时**: 4.57s
- **平均耗时**: 4.5678s
- **耗时分布**: P50=4.5678s, P95=4.5678s, P99=4.5678s

#### 归一化 SQL
```sql
DELETE FROM session_tokens WHERE expired_at < NOW();
```

#### 最慢样本

1. **耗时**: 4.5678s (行 60-62)
   ```sql
   DELETE FROM session_tokens WHERE expired_at < NOW();
   ```

### 7. 指纹 `0b28afb40dc10f0a...`

- **类型**: SELECT
- **涉及表**: orders
- **执行次数**: 2
- **总耗时**: 4.02s
- **平均耗时**: 2.0122s
- **耗时分布**: P50=0.5678s, P95=3.4567s, P99=3.4567s

#### 归一化 SQL
```sql
SELECT * FROM orders WHERE user_id = ? AND status = ?;
```

#### 最慢样本

1. **耗时**: 3.4567s (行 33-35)
   ```sql
   SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';
   ```

2. **耗时**: 0.5678s (行 48-50)
   ```sql
   SELECT * FROM orders WHERE user_id = 456 AND status = 'completed';
   ```

### 8. 指纹 `7fa18baff83d33db...`

- **类型**: SELECT
- **涉及表**: users
- **执行次数**: 2
- **总耗时**: 2.47s
- **平均耗时**: 1.2345s
- **耗时分布**: P50=0.1234s, P95=2.3456s, P99=2.3456s

#### 归一化 SQL
```sql
SELECT * FROM users WHERE status = ? AND created_at > ?;
```

#### 最慢样本

1. **耗时**: 2.3456s (行 3-5)
   ```sql
   SELECT * FROM users WHERE status = 'active' AND created_at > '2024-01-01';
   ```

2. **耗时**: 0.1234s (行 18-20)
   ```sql
   SELECT * FROM users WHERE status = 'inactive' AND created_at > '2023-12-01';
   ```

### 9. 指纹 `60fab5496c02e6e8...`

- **类型**: SELECT
- **涉及表**: products
- **执行次数**: 1
- **总耗时**: 1.23s
- **平均耗时**: 1.2345s
- **耗时分布**: P50=1.2345s, P95=1.2345s, P99=1.2345s

#### 归一化 SQL
```sql
SELECT * FROM products WHERE category = ? AND price > ?;
```

#### 最慢样本

1. **耗时**: 1.2345s (行 54-56)
   ```sql
   SELECT * FROM products WHERE category = 'electronics' AND price > 100;
   ```

### 10. 指纹 `e6f4d0151e40edbb...`

- **类型**: SELECT
- **涉及表**: products
- **执行次数**: 1
- **总耗时**: 0.89s
- **平均耗时**: 0.8901s
- **耗时分布**: P50=0.8901s, P95=0.8901s, P99=0.8901s

#### 归一化 SQL
```sql
SELECT * FROM products WHERE id = ? AND status = ?;
```

#### 最慢样本

1. **耗时**: 0.8901s (行 66-68)
   ```sql
   SELECT * FROM products WHERE id = 999 AND status = 'active';
   ```

## 表统计

| 表名 | 查询数 | 指纹数 | 总耗时(s) | 平均耗时(s) |
|------|--------|--------|------------|------------|
| orders | 4 | 3 | 22.15 | 5.5373 |
| users | 4 | 3 | 16.04 | 4.0095 |
| logs | 1 | 1 | 15.68 | 15.6789 |
| products | 3 | 3 | 8.25 | 2.7493 |
| categories | 1 | 1 | 6.12 | 6.1234 |
| profiles | 1 | 1 | 5.68 | 5.6789 |
| session_tokens | 1 | 1 | 4.57 | 4.5678 |

## 解析信息

- 总行数: 86
- 成功解析: 12
- 解析异常: 0
