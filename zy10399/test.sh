#!/bin/bash
echo "🧪 运行异常配置回滚判定 API 自检测试..."
echo ""
cd test && go run self_test.go
