#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== SQLite Migration Manager API - Curl Examples ==="
echo ""
echo "Base URL: $BASE_URL"
echo ""

# ============================================
# 健康检查
# ============================================
echo "--- 1. Health Check ---"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

# ============================================
# API 信息
# ============================================
echo "--- 2. API Info ---"
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""

# ============================================
# 项目管理
# ============================================
echo "--- 3. Create Project ---"
PROJECT_DATA=$(cat <<'EOF'
{
  "name": "my-new-app",
  "description": "A new application project",
  "db_path": "./data/my-app.db"
}
EOF
)
curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d "$PROJECT_DATA" | python3 -m json.tool
echo ""

echo "--- 4. List Projects ---"
curl -s "$BASE_URL/api/projects" | python3 -m json.tool
echo ""

# ============================================
# 获取示例项目 ID（用于后续示例）
# ============================================
echo "--- Getting Sample Project ID ---"
SAMPLE_PROJECT=$(curl -s "$BASE_URL/api/projects" | python3 -c "
import sys, json
data = json.load(sys.stdin)
projects = data.get('data', {}).get('projects', [])
for p in projects:
    if p['name'] == 'sample-blog-app':
        print(p['id'])
        break
")
echo "Sample Project ID: $SAMPLE_PROJECT"
echo ""

if [ -n "$SAMPLE_PROJECT" ]; then
  # ============================================
  # 项目详情
  # ============================================
  echo "--- 5. Get Project Details ---"
  curl -s "$BASE_URL/api/projects/$SAMPLE_PROJECT" | python3 -m json.tool
  echo ""

  # ============================================
  # 列出迁移
  # ============================================
  echo "--- 6. List Migrations ---"
  curl -s "$BASE_URL/api/migrations/$SAMPLE_PROJECT" | python3 -m json.tool
  echo ""

  # ============================================
  # 生成执行计划 (Apply)
  # ============================================
  echo "--- 7. Generate Apply Plan ---"
  curl -s -X POST "$BASE_URL/api/execution/$SAMPLE_PROJECT/plan?direction=up" | python3 -m json.tool
  echo ""

  # ============================================
  # Dry Run Apply
  # ============================================
  echo "--- 8. Dry Run Apply (Preview) ---"
DRY_RUN_DATA=$(cat <<'EOF'
{
  "dry_run": true
}
EOF
)
  curl -s -X POST "$BASE_URL/api/execution/$SAMPLE_PROJECT/apply" \
    -H "Content-Type: application/json" \
    -d "$DRY_RUN_DATA" | python3 -m json.tool
  echo ""

  # ============================================
  # 健康检查
  # ============================================
  echo "--- 9. Health Check Database ---"
  curl -s "$BASE_URL/api/execution/$SAMPLE_PROJECT/check" | python3 -m json.tool
  echo ""

  # ============================================
  # 验证迁移
  # ============================================
  echo "--- 10. Validate Migrations ---"
  curl -s -X POST "$BASE_URL/api/migrations/$SAMPLE_PROJECT/validate" | python3 -m json.tool
  echo ""

  # ============================================
  # 导出报告
  # ============================================
  echo "--- 11. Export Report (JSON) ---"
  curl -s "$BASE_URL/api/execution/$SAMPLE_PROJECT/export?format=json" | python3 -m json.tool
  echo ""

  echo "--- 12. Export Report (Markdown Preview) ---"
  curl -s "$BASE_URL/api/execution/$SAMPLE_PROJECT/preview-export?format=markdown" | python3 -m json.tool
  echo ""
fi

# ============================================
# 创建单个迁移示例
# ============================================
echo "--- 13. Create Single Migration Example ---"
if [ -n "$SAMPLE_PROJECT" ]; then
MIGRATION_DATA=$(cat <<'EOF'
{
  "version": "0007",
  "name": "add_user_settings",
  "description": "Add settings table for user preferences",
  "up_sql": "CREATE TABLE user_settings (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, setting_key TEXT NOT NULL, setting_value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)); CREATE INDEX idx_user_settings_user ON user_settings(user_id);",
  "down_sql": "DROP INDEX IF EXISTS idx_user_settings_user; DROP TABLE IF EXISTS user_settings;",
  "dependencies": ["0001"]
}
EOF
)
  curl -s -X POST "$BASE_URL/api/migrations/$SAMPLE_PROJECT" \
    -H "Content-Type: application/json" \
    -d "$MIGRATION_DATA" | python3 -m json.tool
  echo ""
fi

# ============================================
# 批量导入示例
# ============================================
echo "--- 14. Batch Import Example ---"
if [ -n "$SAMPLE_PROJECT" ]; then
BATCH_DATA=$(cat <<'EOF'
{
  "migrations": [
    {
      "version": "0008",
      "name": "add_notifications",
      "description": "Add notifications table",
      "up_sql": "CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, message TEXT, read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);",
      "down_sql": "DROP TABLE IF EXISTS notifications;",
      "dependencies": ["0001"]
    },
    {
      "version": "0009",
      "name": "add_notification_index",
      "description": "Add index to notifications",
      "up_sql": "CREATE INDEX idx_notifications_user ON notifications(user_id); CREATE INDEX idx_notifications_read ON notifications(read);",
      "down_sql": "DROP INDEX IF EXISTS idx_notifications_read; DROP INDEX IF EXISTS idx_notifications_user;",
      "dependencies": ["0008"]
    }
  ]
}
EOF
)
  curl -s -X POST "$BASE_URL/api/migrations/$SAMPLE_PROJECT/import" \
    -H "Content-Type: application/json" \
    -d "$BATCH_DATA" | python3 -m json.tool
  echo ""
fi

# ============================================
# 解析迁移文件内容示例
# ============================================
echo "--- 15. Parse Migration Content Example ---"
if [ -n "$SAMPLE_PROJECT" ]; then
PARSE_DATA=$(cat <<'EOF'
{
  "content": "-- UP\nCREATE TABLE example (id INTEGER PRIMARY KEY);\n-- DOWN\nDROP TABLE IF EXISTS example;",
  "version": "test-001",
  "name": "test_migration"
}
EOF
)
  curl -s -X POST "$BASE_URL/api/migrations/$SAMPLE_PROJECT/parse" \
    -H "Content-Type: application/json" \
    -d "$PARSE_DATA" | python3 -m json.tool
  echo ""
fi

# ============================================
# 执行历史
# ============================================
echo "--- 16. Execution History ---"
if [ -n "$SAMPLE_PROJECT" ]; then
  curl -s "$BASE_URL/api/projects/$SAMPLE_PROJECT/history" | python3 -m json.tool
  echo ""
fi

echo "=== All Examples Complete ==="
echo ""
echo "Tips:"
echo "  - To actually apply migrations, use: \"dry_run\": false"
echo "  - To rollback, use: POST /api/execution/:projectId/rollback"
echo "  - For real projects, replace sample-blog-app with your own project"
