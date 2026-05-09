-- 测试数据生成脚本
-- 使用这些脚本生成测试数据用于混沌实验

-- 生成用户
INSERT INTO users (username, email, password_hash, status)
SELECT 
    'user_' || i,
    'user_' || i || '@example.com',
    'hash_' || md5(i::text),
    CASE WHEN i % 10 = 0 THEN 'inactive' ELSE 'active' END
FROM generate_series(1, 1000) i;

-- 生成订单
INSERT INTO orders (user_id, order_no, amount, status)
SELECT 
    (i % 1000) + 1,
    'ORD-' || to_char(now() + (i || ' seconds')::interval, 'YYYYMMDDHH24MISS'),
    (random() * 1000)::numeric(10,2),
    CASE 
        WHEN i % 5 = 0 THEN 'cancelled'
        WHEN i % 3 = 0 THEN 'shipped'
        WHEN i % 2 = 0 THEN 'paid'
        ELSE 'pending'
    END
FROM generate_series(1, 5000) i;

-- 添加一些重复邮箱用于测试去重
UPDATE users SET email = 'duplicate@test.com' WHERE id IN (10, 20, 30);

-- 添加一些 NULL 邮箱
UPDATE users SET email = NULL WHERE id IN (40, 50, 60);
