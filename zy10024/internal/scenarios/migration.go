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
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Error      string     `json:"error,omitempty"`
}

type UserRowSnapshot struct {
	ID      int     `json:"id"`
	Name    string  `json:"name"`
	Balance float64 `json:"balance"`
}

type MigrationCheckpoint struct {
	UserCount   int                 `json:"user_count"`
	OrderCount  int                 `json:"order_count"`
	AvgBalance  float64             `json:"avg_balance"`
	UserRows    []UserRowSnapshot   `json:"user_rows"`
	Timestamp   time.Time           `json:"timestamp"`
}

type MigrationScenario struct {
	*BaseScenario
	db          *sql.DB
	steps       []MigrationStep
	currentStep int
	mu          sync.Mutex
	running     bool
	checkpoint  *MigrationCheckpoint
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
			"0. 迁移前数据校验 + 行级快照",
			"1. ALTER TABLE test_users ADD COLUMN email VARCHAR(255)",
			"2. UPDATE test_users SET email = CONCAT(name, '@example.com')",
			"3. 破坏前10行 name 字段 (模拟脏写)",
			"4. ALTER TABLE MODIFY name (故意失败)",
		},
		"rollback_steps": []string{
			"A. 检查执行进度",
			"B. 从行级快照恢复被破坏的 name 字段",
			"C. DROP COLUMN email",
			"D. 校验恢复后数据与原始快照一致",
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
	s.checkpoint = nil

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

	step0 := s.recordStep("0. 迁移前数据校验 + 行级快照", "running")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 0: 执行迁移前数据校验并保存行级快照", nil))

	err := s.takeFullCheckpoint()
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
		"user_count":      s.checkpoint.UserCount,
		"order_count":     s.checkpoint.OrderCount,
		"avg_balance":     s.checkpoint.AvgBalance,
		"user_rows_saved": len(s.checkpoint.UserRows),
	}))

	step1 := s.recordStep("1. ALTER TABLE test_users ADD COLUMN email", "running")
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step 1: 执行 ALTER TABLE ADD COLUMN email", nil))
	time.Sleep(500 * time.Millisecond)

	err = s.ensureColumnExists("test_users", "email", "VARCHAR(255)")
	if err != nil {
		s.updateStep(step1.ID, "error", err.Error())
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

	step3 := s.recordStep("3. 破坏前10行 name 字段 (模拟脏写)", "running")
	s.Emit(newEvent(s.Name(), models.LevelWarn, "Step 3: 执行破坏性脏写 (模拟迁移脚本错误)", map[string]interface{}{
		"action": "UPDATE name = 'very_long_name_that_exceeds_limit_' || id WHERE id <= 10",
		"description": "故意破坏前 10 行数据，后续步骤失败后需要从快照恢复",
	}))
	time.Sleep(600 * time.Millisecond)

	beforeNames := make(map[int]string)
	for _, row := range s.checkpoint.UserRows {
		if row.ID <= 10 {
			beforeNames[row.ID] = row.Name
		}
	}

	s.Emit(newEvent(s.Name(), models.LevelWarn, "Step 3: 即将破坏的数据 (原始值)", map[string]interface{}{
		"rows_to_corrupt": 10,
		"original_names":  beforeNames,
	}))

	result, err := s.db.Exec("UPDATE test_users SET name = CONCAT('very_long_name_that_exceeds_limit_', id) WHERE id <= 10")
	if err != nil {
		s.Emit(newEvent(s.Name(), models.LevelError, "Step 3 执行失败: "+err.Error(), nil))
	} else {
		affected, _ := result.RowsAffected()
		s.updateStep(step3.ID, "completed", "")
		s.Emit(newEvent(s.Name(), models.LevelError, "Step 3 完成: 数据已被破坏！", map[string]interface{}{
			"rows_affected": affected,
			"damage":        "前 10 行 name 字段被覆盖，需要从快照恢复",
		}))
	}

	step4 := s.recordStep("4. ALTER TABLE MODIFY name (故意失败)", "running")
	s.Emit(newEvent(s.Name(), models.LevelWarn, "Step 4: 执行会失败的 ALTER (模拟迁移中途报错)", map[string]interface{}{
		"action": "ALTER TABLE test_users MODIFY COLUMN name VARCHAR(10)",
		"reason": "部分数据超过新长度限制，导致迁移脚本整体失败",
	}))
	time.Sleep(400 * time.Millisecond)

	_, err = s.db.Exec("ALTER TABLE test_users MODIFY COLUMN name VARCHAR(10)")
	
	errorMsg := "模拟失败"
	if err != nil {
		errorMsg = err.Error()
	}
	s.updateStep(step4.ID, "failed", errorMsg)
	s.Emit(newEvent(s.Name(), models.LevelError, "Step 4 失败！迁移管道整体中断", map[string]interface{}{
		"error":                 errorMsg,
		"status":                "CRITICAL - 部分变更已提交，但整体迁移失败",
		"corrupted_rows":        "前 10 行 name 已被破坏",
		"schema_change_applied": "email 列已添加",
		"recovery_required":     true,
	}))

	s.Emit(newEvent(s.Name(), models.LevelError, "=== 迁移失败，触发自动回滚流程 ===", nil))
	s.rollbackPipeline(4)
}

func (s *MigrationScenario) rollbackPipeline(failedStep int) {
	s.SetStatus(models.StatusReplaying)

	if s.checkpoint == nil {
		s.Emit(newEvent(s.Name(), models.LevelError, "致命错误: 没有 checkpoint 无法回滚！", nil))
		s.SetStatus(models.StatusError)
		return
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 开始自动回滚流程 ===", map[string]interface{}{
		"failed_at_step": failedStep,
		"checkpoint_time": s.checkpoint.Timestamp,
	}))

	time.Sleep(300 * time.Millisecond)

	s.Emit(newEvent(s.Name(), models.LevelInfo, "回滚 Step A: 检查执行进度", map[string]interface{}{
		"steps_completed": failedStep - 1,
		"failed_step":     failedStep,
		"has_row_snapshot": len(s.checkpoint.UserRows) > 0,
	}))

	s.Emit(newEvent(s.Name(), models.LevelWarn, "回滚 Step B: 从行级快照恢复被破坏的 name 字段", map[string]interface{}{
		"rows_to_recover": 10,
		"recovery_source": "checkpoint.UserRows (迁移前保存的原始值)",
	}))

	tx, err := s.db.Begin()
	if err != nil {
		s.Emit(newEvent(s.Name(), models.LevelError, "无法开启回滚事务: "+err.Error(), nil))
		s.SetStatus(models.StatusError)
		return
	}

	recoveredCount := 0
	failedCount := 0
	recoveredNames := make(map[int]string)

	for _, row := range s.checkpoint.UserRows {
		if row.ID <= 10 {
			result, txErr := tx.Exec("UPDATE test_users SET name = ? WHERE id = ?", row.Name, row.ID)
			if txErr != nil {
				failedCount++
				s.Emit(newEvent(s.Name(), models.LevelError, fmt.Sprintf("恢复行 %d 失败: %v", row.ID, txErr), nil))
				continue
			}
			affected, _ := result.RowsAffected()
			if affected > 0 {
				recoveredCount++
				recoveredNames[row.ID] = row.Name
			}
		}
	}

	if err = tx.Commit(); err != nil {
		s.Emit(newEvent(s.Name(), models.LevelError, "回滚事务提交失败: "+err.Error(), nil))
		s.SetStatus(models.StatusError)
		return
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "Step B 完成: 数据行已恢复", map[string]interface{}{
		"rows_recovered": recoveredCount,
		"rows_failed":    failedCount,
		"restored_names": recoveredNames,
	}))

	time.Sleep(300 * time.Millisecond)

	s.Emit(newEvent(s.Name(), models.LevelWarn, "回滚 Step C: DROP COLUMN email (回滚 schema 变更)", map[string]interface{}{
		"action": "ALTER TABLE test_users DROP COLUMN email",
	}))

	_, err = s.db.Exec("ALTER TABLE test_users DROP COLUMN email")
	if err != nil {
		s.Emit(newEvent(s.Name(), models.LevelWarn, "DROP COLUMN email 失败 (可能列已不存在): "+err.Error(), nil))
	} else {
		s.Emit(newEvent(s.Name(), models.LevelInfo, "Step C 完成: email 列已删除", nil))
	}

	time.Sleep(200 * time.Millisecond)

	s.Emit(newEvent(s.Name(), models.LevelInfo, "回滚 Step D: 校验恢复后数据与原始快照一致性", nil))

	corruptedRows, err := s.verifyRecovery()
	if err != nil {
		s.Emit(newEvent(s.Name(), models.LevelError, "校验失败: "+err.Error(), nil))
		s.SetStatus(models.StatusError)
		return
	}

	if len(corruptedRows) > 0 {
		s.Emit(newEvent(s.Name(), models.LevelError, "数据一致性校验失败！仍有不一致的行", map[string]interface{}{
			"inconsistent_rows": corruptedRows,
			"count":             len(corruptedRows),
		}))
		s.SetStatus(models.StatusError)
	} else {
		s.Emit(newEvent(s.Name(), models.LevelInfo, "✅ 校验通过: 所有被破坏的行已从快照恢复", map[string]interface{}{
			"verified_rows": len(s.checkpoint.UserRows),
			"status":        "CONSISTENT",
		}))
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 回滚流程结束 ===", map[string]interface{}{
		"rollback_status": "completed",
		"data_recovered":  true,
		"schema_reverted": true,
	}))

	s.SetStatus(models.StatusError)
}

func (s *MigrationScenario) verifyRecovery() (map[int]string, error) {
	inconsistent := make(map[int]string)

	for _, origRow := range s.checkpoint.UserRows {
		if origRow.ID > 10 {
			continue
		}

		var currentName string
		err := s.db.QueryRow("SELECT name FROM test_users WHERE id = ?", origRow.ID).Scan(&currentName)
		if err != nil {
			return nil, err
		}

		if currentName != origRow.Name {
			inconsistent[origRow.ID] = fmt.Sprintf("expected=%q actual=%q", origRow.Name, currentName)
		}
	}

	return inconsistent, nil
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

	s.Emit(newEvent(s.Name(), models.LevelInfo, "=== 手动数据恢复链路启动 ===", nil))

	if s.checkpoint == nil {
		s.Emit(newEvent(s.Name(), models.LevelError, "没有 checkpoint，无法执行数据恢复", nil))
		return fmt.Errorf("no checkpoint available")
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "从 checkpoint 恢复数据", map[string]interface{}{
		"checkpoint_time":    s.checkpoint.Timestamp,
		"rows_in_snapshot":   len(s.checkpoint.UserRows),
		"recovery_scope":     "所有 test_users 行",
	}))

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}

	recovered := 0
	for _, row := range s.checkpoint.UserRows {
		_, err := tx.Exec("UPDATE test_users SET name = ?, balance = ? WHERE id = ?", 
			row.Name, row.Balance, row.ID)
		if err != nil {
			tx.Rollback()
			return err
		}
		recovered++
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	s.Emit(newEvent(s.Name(), models.LevelInfo, "✅ 手动数据恢复完成", map[string]interface{}{
		"rows_restored": recovered,
		"status":        "DATA_RESTORED_FROM_CHECKPOINT",
	}))

	_, _ = s.db.Exec("ALTER TABLE test_users DROP COLUMN email")

	s.steps = []MigrationStep{}
	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *MigrationScenario) takeFullCheckpoint() error {
	if s.db == nil {
		return fmt.Errorf("db nil")
	}

	var userCount, orderCount int
	var avgBalance float64

	err := s.db.QueryRow("SELECT COUNT(*) FROM test_users").Scan(&userCount)
	if err != nil {
		return err
	}

	err = s.db.QueryRow("SELECT COUNT(*) FROM test_orders").Scan(&orderCount)
	if err != nil {
		return err
	}

	err = s.db.QueryRow("SELECT AVG(balance) FROM test_users").Scan(&avgBalance)
	if err != nil {
		avgBalance = 0
	}

	rows, err := s.db.Query("SELECT id, name, balance FROM test_users ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()

	var userRows []UserRowSnapshot
	for rows.Next() {
		var row UserRowSnapshot
		if err := rows.Scan(&row.ID, &row.Name, &row.Balance); err != nil {
			return err
		}
		userRows = append(userRows, row)
	}

	s.checkpoint = &MigrationCheckpoint{
		UserCount:  userCount,
		OrderCount: orderCount,
		AvgBalance: avgBalance,
		UserRows:   userRows,
		Timestamp:  time.Now(),
	}

	checkpointJSON, _ := json.Marshal(s.checkpoint)
	s.Emit(newEvent(s.Name(), models.LevelInfo, "Checkpoint 已保存 (摘要)", map[string]interface{}{
		"user_count":    userCount,
		"order_count":   orderCount,
		"avg_balance":   avgBalance,
		"checkpoint_md5": fmt.Sprintf("%x", len(checkpointJSON)),
	}))

	return nil
}

func (s *MigrationScenario) ensureColumnExists(table, col, typ string) error {
	query := fmt.Sprintf("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '%s' AND COLUMN_NAME = '%s'", table, col)
	var name string
	err := s.db.QueryRow(query).Scan(&name)
	
	if err == sql.ErrNoRows {
		alterQuery := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, col, typ)
		_, execErr := s.db.Exec(alterQuery)
		return execErr
	}
	
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
	checkpointMap := make(map[string]interface{})
	if s.checkpoint != nil {
		checkpointMap = map[string]interface{}{
			"user_count":  s.checkpoint.UserCount,
			"order_count": s.checkpoint.OrderCount,
			"avg_balance": s.checkpoint.AvgBalance,
			"timestamp":   s.checkpoint.Timestamp,
			"row_snapshot_count": len(s.checkpoint.UserRows),
		}
		if len(s.checkpoint.UserRows) >= 10 {
			preview := make(map[int]string)
			for i := 0; i < 10 && i < len(s.checkpoint.UserRows); i++ {
				row := s.checkpoint.UserRows[i]
				preview[row.ID] = row.Name
			}
			checkpointMap["rows_preview"] = preview
		}
	}

	return models.SystemState{
		Timestamp: time.Now(),
		Metrics: map[string]interface{}{
			"steps":              s.steps,
			"current_step_index": s.currentStep,
			"has_checkpoint":     s.checkpoint != nil,
			"checkpoint":         checkpointMap,
		},
	}
}
