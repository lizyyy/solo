package scenarios

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"chaos-simulator/pkg/models"
)

type MigrationStep struct {
	ID          int64
	Name        string
	Status      string
	StartedAt   *time.Time
	FinishedAt  *time.Time
	Error       string
}

type MigrationScenario struct {
	*BaseScenario
	db          *sql.DB
	steps       []MigrationStep
	currentStep int
	mu          sync.Mutex
	running     bool
	checkpoint  map[string]interface{}
}

func NewMigrationScenario(db *sql.DB) *MigrationScenario {
	return &MigrationScenario{
		BaseScenario: NewBaseScenario("migration_rollback", models.ScenarioMigration),
		db:           db,
		steps:        []MigrationStep{},
	}
}

func (s *MigrationScenario) Config() map[string]interface{} {
	return map[string]interface{}{
		"scenario": "模拟数据库迁移失败导致老数据受损",
		"migration_steps": []string{
			"0. 迁移前数据校验(checkpoint)",
			"1. ALTER TABLE test_users ADD COLUMN email VARCHAR(255)",
			"2. UPDATE test_users SET email = CONCAT(name, '@example.com')",
			"3. ALTER TABLE test_users MODIFY COLUMN name VARCHAR(50) (故意失败)",
			"4. ALTER TABLE test_orders ADD COLUMN discount DECIMAL(5,2)",
		},
		"recovery_steps": []string{
			"A. 检查迁移执行到哪一步",
			"B. 回滚已执行的变更",
			"C. 从 checkpoint 校验数据完整性",
			"D. 标记迁移失败",
		},
	}
}

func (s *MigrationScenario) Start() error {
	if s.db == nil {
		return fmt.Errorf("DB connection not available")
	}

	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("migration already running")
	}
	s.running = true
	s.mu.Unlock()

	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	s.ClearEvents()
	s.steps = []MigrationStep{}
	s.currentStep = 0

	go s.executeMigrationPipeline()
	return nil
}

func (s *MigrationScenario) executeMigrationPipeline() {
	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 开始数据库迁移流程 ===", nil))

	step0 := s.recordStep("0. 迁移前数据校验(checkpoint)", "running")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 0: 执行迁移前数据校验", nil))

	userCount, orderCount, avgBalance, err := s.takeCheckpoint()
	if err != nil {
		s.updateStep(step0.ID, "failed", err.Error())
		s.Emit(newEvent(s.Name(), models.LevelError, "Step 0 失败: 无法创建数据校验点", map[string]interface{}{
			"error": err.Error(),
		}))
		s.SetStatus(models.StatusError)
		return
	}

	s.updateStep(step0.ID, "completed", "")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 0 完成: checkpoint 已创建", map[string]interface{}{
		"users":       userCount,
		"orders":      orderCount,
		"avg_balance": avgBalance,
	}))

	step1 := s.recordStep("1. ALTER TABLE test_users ADD COLUMN email VARCHAR(255)", "running")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 1: 执行 ALTER TABLE ADD COLUMN email", nil))
	time.Sleep(500 * time.Millisecond)

	err = s.tryAddColumn("test_users", "email", "VARCHAR(255)")
	if err != nil {
		s.updateStep(step1.ID, "skipped", err.Error())
		s.Emit(newEvent(s.Name(), models.LevelWarn, "Step 1: email列可能已存在", map[string]interface{}{
			"warning": err.Error(),
		}))
	} else {
		s.updateStep(step1.ID, "completed", "")
		s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 1 完成: email 列已添加", nil))
	}

	step2 := s.recordStep("2. UPDATE test_users SET email", "running")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 2: 批量更新用户 email", nil))
	time.Sleep(800 * time.Millisecond)

	_, err = s.db.Exec("UPDATE test_users SET email = CONCAT(name, '@example.com') WHERE email IS NULL OR email = ''")
	if err != nil {
		s.updateStep(step2.ID, "failed", err.Error())
		s.Emit(newEvent(s.Name(), models.LevelError, "Step 2 失败: 无法更新 email", map[string]interface{}{
			"error": err.Error(),
		}))
		s.Emit(newEvent(s.Name(), models.LevelError, "=== 迁移管道中断，准备回滚 ===", nil))
		s.rollbackPipeline(2)
		return
	}
	s.updateStep(step2.ID, "completed", "")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 2 完成: email 已回填", nil))

	step3 := s.recordStep("3. ALTER TABLE test_users MODIFY name (故意失败)", "running")
	s.Emit(newEvent(s.Name(), models.LevelWarn, "Step 3: 执行破坏性迁移 (故意失败)", map[string]interface{}{
		"action": "MODIFY COLUMN name VARCHAR(50)",
		"expected_result": "失败 - 故意让某些数据超过新长度",
	}))
	time.Sleep(600 * time.Millisecond)

	_, err = s.db.Exec("UPDATE test_users SET name = CONCAT('very_long_name_that_exceeds_limit_', id) WHERE id <= 10")
	if err == nil {
		time.Sleep(200 * time.Millisecond)
	}
	_, err = s.db.Exec("ALTER TABLE test_users MODIFY COLUMN name VARCHAR(10)")
	
	s.updateStep(step3.ID, "failed", fmt.Sprintf("模拟失败: %v", err))
	s.Emit(newEvent(s.Name(), models.LevelError, "Step 3 失败！！！数据可能已受损", map[string]interface{}{
		"error":             "迁移脚本执行失败",
		"affected_rows":     "至少 10 行被修改",
		"inconsistency":     "部分数据已执行 Step 1/2，但 Step 3 失败",
		"recovery_required": true,
	}))

	s.Emit(newEvent(s.Name(), models.LevelError, "=== 迁移失败，触发回滚流程 ===", nil))
	s.rollbackPipeline(3)
}

func (s *MigrationScenario) rollbackPipeline(failedStep int) {
	s.SetStatus(models.StatusReplaying)
	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 开始回滚流程 ===", map[string]interface{}{
		"failed_at_step": failedStep,
	}))

	time.Sleep(300 * time.Millisecond)

	s.Emit(newEvent(s.Name(), models.LevelInfo, "回滚 Step A: 检查迁移执行状态", map[string]interface{}{
		"steps_completed": failedStep - 1,
		"failed_step":     failedStep,
	}))

	if failedStep >= 2 {
		s.Emit(newEvent(s.Name(), models.LevelWarn, "回滚 Step B: 回滚 Step 2 - email 数据更新", map[string]interface{}{
			"action": "将 email 列置空或恢复",
		}))
		time.Sleep(400 * time.Millisecond)
		s.db.Exec("UPDATE test_users SET email = NULL WHERE email LIKE '%@example.com'")
	}

	if failedStep >= 1 {
		s.Emit(newEvent(s.Name(), models.LevelWarn, "回滚 Step B2: 回滚 Step 1 - 删除 email 列", map[string]interface{}{
			"action": "DROP COLUMN email",
		}))
		time.Sleep(300 * time.Millisecond)
		s.db.Exec("ALTER TABLE test_users DROP COLUMN email")
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "回滚 Step C: 与 checkpoint 对比校验", map[string]interface{}{
		"checkpoint_users":   s.checkpoint["user_count"],
		"checkpoint_orders":  s.checkpoint["order_count"],
		"checkpoint_balance": s.checkpoint["avg_balance"],
	}))

	time.Sleep(200 * time.Millisecond)

	userCount, orderCount, avgBalance, _ := s.takeCheckpoint()
	diff := map[string]interface{}{
		"users_before":  s.checkpoint["user_count"],
		"users_after":   userCount,
		"orders_before": s.checkpoint["order_count"],
		"orders_after":  orderCount,
		"balance_before": s.checkpoint["avg_balance"],
		"balance_after": avgBalance,
	}

	diffJSON, _ := json.Marshal(diff)
	s.Emit(newEvent(s.Name(), models.LevelInfo, "回滚 Step D: 数据校验差异报告", map[string]interface{}{
		"diff": string(diffJSON),
		"status": "已尝试从迁移失败中恢复",
	}))

	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 回滚流程结束 ===", map[string]interface{}{
		"rollback_status": "completed",
		"recommendation": "请人工对比 checkpoint 确认数据一致性",
	}))

	s.SetStatus(models.StatusError)
}

func (s *MigrationScenario) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		s.running = false
	}
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *MigrationScenario) Recover() error {
	s.Stop()

	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 手动数据恢复链路 ===", nil))

	if s.checkpoint != nil {
		s.Emit(newEvent(s.Name(), models.LevelInfo, "从 checkpoint 恢复: 已有的迁移前数据快照", map[string]interface{}{
			"checkpoint": s.checkpoint,
		}))
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "数据恢复步骤说明:", map[string]interface{}{
		"1": "清理残留的 email 列 (如果存在)",
		"2": "对比 test_users.name 原始值与当前值",
		"3": "从备份恢复被破坏的 10 行数据",
		"4": "再次执行完整数据校验",
	}))

	s.steps = []MigrationStep{}
	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *MigrationScenario) takeCheckpoint() (int, int, float64, error) {
	if s.db == nil {
		return 0, 0, 0, fmt.Errorf("db nil")
	}

	var userCount, orderCount int
	var avgBalance float64

	err := s.db.QueryRow("SELECT COUNT(*) FROM test_users").Scan(&userCount)
	if err != nil {
		return 0, 0, 0, err
	}

	err = s.db.QueryRow("SELECT COUNT(*) FROM test_orders").Scan(&orderCount)
	if err != nil {
		return 0, 0, 0, err
	}

	err = s.db.QueryRow("SELECT AVG(balance) FROM test_users").Scan(&avgBalance)
	if err != nil {
		avgBalance = 0
	}

	s.checkpoint = map[string]interface{}{
		"user_count":  userCount,
		"order_count": orderCount,
		"avg_balance": avgBalance,
		"timestamp":   time.Now(),
	}

	return userCount, orderCount, avgBalance, nil
}

func (s *MigrationScenario) tryAddColumn(table, col, typ string) error {
	query := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, col, typ)
	_, err := s.db.Exec(query)
	return err
}

func (s *MigrationScenario) recordStep(name, status string) MigrationStep {
	now := time.Now()
	step := MigrationStep{
		ID:        int64(len(s.steps) + 1),
		Name:      name,
		Status:    status,
		StartedAt: &now,
	}
	s.mu.Lock()
	s.steps = append(s.steps, step)
	s.mu.Unlock()
	return step
}

func (s *MigrationScenario) updateStep(id int64, status, errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.steps {
		if s.steps[i].ID == id {
			now := time.Now()
			s.steps[i].Status = status
			s.steps[i].FinishedAt = &now
			s.steps[i].Error = errMsg
			break
		}
	}
}

func (s *MigrationScenario) CurrentState() models.SystemState {
	return models.SystemState{
		Timestamp: time.Now(),
		Metrics: map[string]interface{}{
			"steps":              s.steps,
			"current_step_index": s.currentStep,
			"has_checkpoint":     s.checkpoint != nil,
			"checkpoint":         s.checkpoint,
		},
	}
}
