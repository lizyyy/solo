package service

import (
	"testing"
	"task-recovery-api/database"
	"task-recovery-api/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB() {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	database.DB = db
	db.AutoMigrate(&models.TaskRecovery{}, &models.TaskImpact{}, &models.TaskLog{})
}

func TestCreateTask(t *testing.T) {
	setupTestDB()
	
	t.Run("正常创建任务", func(t *testing.T) {
		req := CreateTaskRequest{
			TaskName:      "TEST_BATCH",
			ScheduledTime: "2024-05-20 02:00:00",
			MissReason:    "SCHEDULER_DOWN",
			CreatedBy:     "test_user",
		}
		
		task, err := CreateTask(req)
		if err != nil {
			t.Errorf("创建任务失败: %v", err)
		}
		if task.ID == "" {
			t.Error("任务ID为空")
		}
		if task.ActualStatus != "PENDING" {
			t.Errorf("初始状态错误, 期望PENDING, 实际%s", task.ActualStatus)
		}
	})
	
	t.Run("同一任务同一日期互斥控制", func(t *testing.T) {
		req1 := CreateTaskRequest{
			TaskName:      "MUTEX_TEST",
			ScheduledTime: "2024-05-20 02:00:00",
			CreatedBy:     "user1",
		}
		_, err1 := CreateTask(req1)
		if err1 != nil {
			t.Errorf("第一个任务创建失败: %v", err1)
		}
		
		req2 := CreateTaskRequest{
			TaskName:      "MUTEX_TEST",
			ScheduledTime: "2024-05-20 02:00:00",
			CreatedBy:     "user2",
		}
		_, err2 := CreateTask(req2)
		if err2 == nil {
			t.Error("第二个任务应该创建失败，但成功了")
		}
	})
}

func TestStatusTransition(t *testing.T) {
	setupTestDB()
	
	task, _ := CreateTask(CreateTaskRequest{
		TaskName:      "STATUS_TEST",
		ScheduledTime: "2024-05-20 02:00:00",
		CreatedBy:     "test_user",
	})
	
	t.Run("正常状态推进 PENDING→DETECTED", func(t *testing.T) {
		_, err := UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "DETECTED",
			Operator:       "test_user",
			ProcessingNote: "测试",
		})
		if err != nil {
			t.Errorf("状态推进失败: %v", err)
		}
	})
	
	t.Run("重复提交同一状态应失败", func(t *testing.T) {
		_, err := UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "DETECTED",
			Operator:       "test_user",
			ProcessingNote: "重复提交",
		})
		if err == nil {
			t.Error("重复提交同一状态应该失败")
		}
	})
	
	t.Run("无效状态转换应失败", func(t *testing.T) {
		_, err := UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "COMPLETED",
			Operator:       "test_user",
			ProcessingNote: "跳步",
		})
		if err == nil {
			t.Error("无效状态转换应该失败")
		}
	})
	
	t.Run("终态后无法继续推进", func(t *testing.T) {
		UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "ANALYZING",
			Operator:       "test_user",
		})
		UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "RECOVERING",
			Operator:       "test_user",
		})
		UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "COMPLETED",
			Operator:       "test_user",
		})
		
		_, err := UpdateStatus(UpdateStatusRequest{
			ID:             task.ID,
			ToStatus:       "RECOVERING",
			Operator:       "test_user",
		})
		if err == nil {
			t.Error("终态后应该无法继续推进")
		}
	})
}

func TestIsValidStatusTransition(t *testing.T) {
	tests := []struct {
		name     string
		from     models.TaskStatus
		to       models.TaskStatus
		expected bool
	}{
		{"PENDING→DETECTED", "PENDING", "DETECTED", true},
		{"PENDING→CANCELLED", "PENDING", "CANCELLED", true},
		{"DETECTED→ANALYZING", "DETECTED", "ANALYZING", true},
		{"ANALYZING→RECOVERING", "ANALYZING", "RECOVERING", true},
		{"RECOVERING→COMPLETED", "RECOVERING", "COMPLETED", true},
		{"RECOVERING→FAILED", "RECOVERING", "FAILED", true},
		{"FAILED→RECOVERING", "FAILED", "RECOVERING", true},
		{"FAILED→MANUAL_FIX", "FAILED", "MANUAL_FIX", true},
		{"PENDING→COMPLETED", "PENDING", "COMPLETED", false},
		{"COMPLETED→ANY", "COMPLETED", "RECOVERING", false},
		{"CANCELLED→ANY", "CANCELLED", "DETECTED", false},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := models.IsValidStatusTransition(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("%s: 期望%v, 实际%v", tt.name, tt.expected, result)
			}
		})
	}
}

func TestCalculateImpact(t *testing.T) {
	setupTestDB()
	
	task, _ := CreateTask(CreateTaskRequest{
		TaskName:      "IMPACT_TEST",
		ScheduledTime: "2024-05-20 02:00:00",
		CreatedBy:     "test_user",
		Impacts: []CreateImpactRequest{
			{
				ImpactType:    "TYPE_A",
				ImpactScope:   "SCOPE1",
				AffectedCount: 100,
				BusinessDate:  "2024-05-15",
			},
			{
				ImpactType:    "TYPE_A",
				ImpactScope:   "SCOPE2",
				AffectedCount: 200,
				BusinessDate:  "2024-05-15",
			},
			{
				ImpactType:    "TYPE_B",
				ImpactScope:   "SCOPE3",
				AffectedCount: 50,
				BusinessDate:  "2024-05-16",
			},
		},
	})
	
	impact, err := CalculateImpact(task.ID)
	if err != nil {
		t.Errorf("计算影响范围失败: %v", err)
	}
	
	total, ok := impact["total_affected"].(int)
	if !ok || total != 350 {
		t.Errorf("总受影响数错误, 期望350, 实际%d", total)
	}
	
	typeMap, ok := impact["impact_by_type"].(map[string]int)
	if !ok || typeMap["TYPE_A"] != 300 {
		t.Error("按类型统计错误")
	}
}

func TestGenerateReport(t *testing.T) {
	setupTestDB()
	
	task, _ := CreateTask(CreateTaskRequest{
		TaskName:      "REPORT_TEST",
		ScheduledTime: "2024-05-20 02:00:00",
		CreatedBy:     "test_user",
		OriginalInput: "{\"test\":\"input\"}",
	})
	
	UpdateStatus(UpdateStatusRequest{
		ID:             task.ID,
		ToStatus:       "DETECTED",
		Operator:       "test_user",
		OriginalInput:  "{\"step\":\"detect\"}",
		ProcessingNote: "检测到漏跑",
	})
	
	report, err := GenerateReport(task.ID)
	if err != nil {
		t.Errorf("生成报告失败: %v", err)
	}
	
	taskInfo, ok := report["task_info"].(map[string]interface{})
	if !ok {
		t.Error("报告中缺少task_info")
	}
	if taskInfo["task_name"] != "REPORT_TEST" {
		t.Error("报告中任务名称错误")
	}
}

func TestManualFix(t *testing.T) {
	setupTestDB()
	
	task, _ := CreateTask(CreateTaskRequest{
		TaskName:      "MANUAL_TEST",
		ScheduledTime: "2024-05-20 02:00:00",
		CreatedBy:     "test_user",
	})
	
	UpdateStatus(UpdateStatusRequest{
		ID:             task.ID,
		ToStatus:       "DETECTED",
		Operator:       "test_user",
	})
	
	UpdateStatus(UpdateStatusRequest{
		ID:             task.ID,
		ToStatus:       "ANALYZING",
		Operator:       "test_user",
	})
	
	UpdateStatus(UpdateStatusRequest{
		ID:             task.ID,
		ToStatus:       "RECOVERING",
		Operator:       "test_user",
	})
	
	UpdateStatus(UpdateStatusRequest{
		ID:             task.ID,
		ToStatus:       "FAILED",
		Operator:       "test_user",
		OriginalInput:  "{\"error\":\"db_lock\"}",
		ProcessingNote: "数据库锁冲突",
	})
	
	_, err := ManualFix(ManualFixRequest{
		ID:              task.ID,
		Operator:        "dba",
		Remarks:         "已清理锁",
		RecoveryAction:  "MANUAL",
		OriginalInput:   "{\"session_id\":12345}",
		ProcessingNote:  "杀掉阻塞会话",
	})
	
	if err != nil {
		t.Errorf("人工修正失败: %v", err)
	}
	
	updatedTask, _ := GetTaskByID(task.ID)
	if updatedTask.ActualStatus != "MANUAL_FIX" {
		t.Errorf("人工修正后状态错误, 期望MANUAL_FIX, 实际%s", updatedTask.ActualStatus)
	}
}
