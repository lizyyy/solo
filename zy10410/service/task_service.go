package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"task-recovery-api/database"
	"task-recovery-api/models"
	"time"

	"gorm.io/gorm"
)

func parseTime(timeStr string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}
	
	for _, format := range formats {
		if t, err := time.ParseInLocation(format, timeStr, time.Local); err == nil {
			return t, nil
		}
	}
	
	return time.Time{}, fmt.Errorf("无法解析时间: %s", timeStr)
}

type CreateTaskRequest struct {
	TaskName       string                `json:"task_name" binding:"required"`
	ScheduledTime  string                `json:"scheduled_time" binding:"required"`
	MissReason     models.MissReason     `json:"miss_reason"`
	RecoveryAction models.RecoveryAction `json:"recovery_action"`
	Remarks        string                `json:"remarks"`
	CreatedBy      string                `json:"created_by"`
	OriginalInput  string                `json:"original_input"`
	Impacts        []CreateImpactRequest `json:"impacts"`
}

type CreateImpactRequest struct {
	ImpactType    string `json:"impact_type"`
	ImpactScope   string `json:"impact_scope"`
	ImpactDesc    string `json:"impact_desc"`
	AffectedCount int    `json:"affected_count"`
	BusinessDate  string `json:"business_date"`
}

type UpdateStatusRequest struct {
	ID             string                `json:"id" binding:"required"`
	ToStatus       models.TaskStatus     `json:"to_status" binding:"required"`
	Operator       string                `json:"operator"`
	ProcessingNote string                `json:"processing_note"`
	OriginalInput  string                `json:"original_input"`
	Action         string                `json:"action"`
}

type ManualFixRequest struct {
	ID              string                  `json:"id" binding:"required"`
	Remarks         string                  `json:"remarks"`
	Operator        string                  `json:"operator"`
	RecoveryAction  models.RecoveryAction   `json:"recovery_action"`
	ProcessingNote  string                  `json:"processing_note"`
	OriginalInput   string                  `json:"original_input"`
}

type TaskQueryFilter struct {
	TaskName     string             `form:"task_name"`
	ActualStatus models.TaskStatus  `form:"actual_status"`
	StartDate    *time.Time         `form:"start_date"`
	EndDate      *time.Time         `form:"end_date"`
	Page         int                `form:"page"`
	PageSize     int                `form:"page_size"`
}

func CreateTask(req CreateTaskRequest) (*models.TaskRecovery, error) {
	db := database.GetDB()
	
	scheduledTime, err := parseTime(req.ScheduledTime)
	if err != nil {
		return nil, err
	}
	
	var existingCount int64
	db.Model(&models.TaskRecovery{}).
		Where("task_name = ? AND DATE(scheduled_time) = DATE(?) AND actual_status NOT IN ?", 
			req.TaskName, scheduledTime, []models.TaskStatus{models.StatusCompleted, models.StatusCancelled}).
		Count(&existingCount)
	
	if existingCount > 0 {
		return nil, errors.New("该任务在同一计划日期已有未完成的漏跑记录，不允许重复创建")
	}
	
	task := &models.TaskRecovery{
		TaskName:       req.TaskName,
		ScheduledTime:  scheduledTime,
		ActualStatus:   models.StatusPending,
		MissReason:     req.MissReason,
		RecoveryAction: req.RecoveryAction,
		Remarks:        req.Remarks,
		CreatedBy:      req.CreatedBy,
		UpdatedBy:      req.CreatedBy,
		OriginalInput:  req.OriginalInput,
		Version:        0,
	}
	
	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(task).Error; err != nil {
			return err
		}
		
		for _, imp := range req.Impacts {
			impact := &models.TaskImpact{
				TaskRecoveryID: task.ID,
				ImpactType:     imp.ImpactType,
				ImpactScope:    imp.ImpactScope,
				ImpactDesc:     imp.ImpactDesc,
				AffectedCount:  imp.AffectedCount,
				BusinessDate:   imp.BusinessDate,
			}
			if err := tx.Create(impact).Error; err != nil {
				return err
			}
		}
		
		log := &models.TaskLog{
			TaskRecoveryID: task.ID,
			FromStatus:     "",
			ToStatus:       models.StatusPending,
			Action:         "CREATE",
			Operator:       req.CreatedBy,
			OriginalInput:  req.OriginalInput,
			ProcessingNote: "创建漏跑恢复任务",
		}
		return tx.Create(log).Error
	})
	
	if txErr != nil {
		return nil, txErr
	}
	
	return GetTaskByID(task.ID)
}

func GetTaskByID(id string) (*models.TaskRecovery, error) {
	db := database.GetDB()
	var task models.TaskRecovery
	err := db.Preload("Impacts").Preload("Logs", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at ASC")
	}).First(&task, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func QueryTasks(filter TaskQueryFilter) ([]models.TaskRecovery, int64, error) {
	db := database.GetDB()
	query := db.Model(&models.TaskRecovery{})
	
	if filter.TaskName != "" {
		query = query.Where("task_name LIKE ?", "%"+filter.TaskName+"%")
	}
	if filter.ActualStatus != "" {
		query = query.Where("actual_status = ?", filter.ActualStatus)
	}
	if filter.StartDate != nil {
		query = query.Where("scheduled_time >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("scheduled_time <= ?", *filter.EndDate)
	}
	
	var total int64
	query.Count(&total)
	
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize
	
	var tasks []models.TaskRecovery
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tasks).Error
	if err != nil {
		return nil, 0, err
	}
	
	return tasks, total, nil
}

func UpdateStatus(req UpdateStatusRequest) (*models.TaskRecovery, error) {
	db := database.GetDB()
	var task models.TaskRecovery
	
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&task, "id = ?", req.ID).Error; err != nil {
			return err
		}
		
		if models.IsFinalStatus(task.ActualStatus) {
			return fmt.Errorf("任务已处于终态[%s]，无法继续推进", task.ActualStatus)
		}
		
		if task.ActualStatus == req.ToStatus {
			return fmt.Errorf("任务已处于目标状态[%s]，无需重复推进", task.ActualStatus)
		}
		
		if !models.IsValidStatusTransition(task.ActualStatus, req.ToStatus) {
			return fmt.Errorf("无效的状态转换: %s -> %s", task.ActualStatus, req.ToStatus)
		}
		
		now := time.Now()
		updates := map[string]interface{}{
			"actual_status":  req.ToStatus,
			"updated_at":     now,
			"updated_by":     req.Operator,
			"version":        task.Version + 1,
		}
		
		if req.ToStatus == models.StatusDetected {
			updates["detected_at"] = now
		} else if req.ToStatus == models.StatusCompleted {
			updates["recovered_at"] = now
		}
		
		result := tx.Model(&task).Where("version = ?", task.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("并发冲突：任务已被其他操作修改")
		}
		
		log := &models.TaskLog{
			TaskRecoveryID: task.ID,
			FromStatus:     task.ActualStatus,
			ToStatus:       req.ToStatus,
			Action:         req.Action,
			Operator:       req.Operator,
			OriginalInput:  req.OriginalInput,
			ProcessingNote: req.ProcessingNote,
		}
		if err := tx.Create(log).Error; err != nil {
			return err
		}
		
		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	return GetTaskByID(req.ID)
}

func ManualFix(req ManualFixRequest) (*models.TaskRecovery, error) {
	db := database.GetDB()
	var task models.TaskRecovery
	
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&task, "id = ?", req.ID).Error; err != nil {
			return err
		}
		
		if models.IsFinalStatus(task.ActualStatus) {
			return fmt.Errorf("任务已处于终态[%s]，无法进行人工修正", task.ActualStatus)
		}
		
		now := time.Now()
		updates := map[string]interface{}{
			"actual_status":   models.StatusManualFix,
			"recovery_action": req.RecoveryAction,
			"remarks":         req.Remarks,
			"updated_at":      now,
			"updated_by":      req.Operator,
			"version":         task.Version + 1,
		}
		
		result := tx.Model(&task).Where("version = ?", task.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("并发冲突：任务已被其他操作修改")
		}
		
		log := &models.TaskLog{
			TaskRecoveryID: task.ID,
			FromStatus:     task.ActualStatus,
			ToStatus:       models.StatusManualFix,
			Action:         "MANUAL_FIX",
			Operator:       req.Operator,
			OriginalInput:  req.OriginalInput,
			ProcessingNote: req.ProcessingNote,
		}
		return tx.Create(log).Error
	})
	
	if err != nil {
		return nil, err
	}
	
	return GetTaskByID(req.ID)
}

func CalculateImpact(id string) (map[string]interface{}, error) {
	task, err := GetTaskByID(id)
	if err != nil {
		return nil, err
	}
	
	totalAffected := 0
	impactByType := make(map[string]int)
	impactByDate := make(map[string]int)
	
	for _, imp := range task.Impacts {
		totalAffected += imp.AffectedCount
		impactByType[imp.ImpactType] += imp.AffectedCount
		if imp.BusinessDate != "" {
			impactByDate[imp.BusinessDate] += imp.AffectedCount
		}
	}
	
	return map[string]interface{}{
		"task_id":         task.ID,
		"task_name":       task.TaskName,
		"status":          task.ActualStatus,
		"total_affected":  totalAffected,
		"impact_by_type":  impactByType,
		"impact_by_date":  impactByDate,
		"impact_count":    len(task.Impacts),
	}, nil
}

func GenerateReport(id string) (map[string]interface{}, error) {
	task, err := GetTaskByID(id)
	if err != nil {
		return nil, err
	}
	
	impactSummary, _ := CalculateImpact(id)
	
	anomalies := []map[string]interface{}{}
	for _, log := range task.Logs {
		if log.ToStatus == models.StatusFailed {
			anomalies = append(anomalies, map[string]interface{}{
				"time":           log.CreatedAt,
				"operator":       log.Operator,
				"original_input": log.OriginalInput,
				"conclusion":     log.ProcessingNote,
				"action":         log.Action,
			})
		}
	}
	
	return map[string]interface{}{
		"task_info": map[string]interface{}{
			"id":              task.ID,
			"task_name":       task.TaskName,
			"scheduled_time":  task.ScheduledTime,
			"current_status":  task.ActualStatus,
			"miss_reason":     task.MissReason,
			"recovery_action": task.RecoveryAction,
			"created_at":      task.CreatedAt,
			"detected_at":     task.DetectedAt,
			"recovered_at":    task.RecoveredAt,
			"created_by":      task.CreatedBy,
			"remarks":         task.Remarks,
		},
		"impact_summary": impactSummary,
		"impacts":        task.Impacts,
		"status_history": task.Logs,
		"anomalies":      anomalies,
		"anomaly_count":  len(anomalies),
	}, nil
}

func ExportReport(id string) (string, error) {
	report, err := GenerateReport(id)
	if err != nil {
		return "", err
	}
	
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}
	
	return string(data), nil
}

func DetectMissTasks(taskName string, scheduledTimeStr string, operator string) (*models.TaskRecovery, error) {
	db := database.GetDB()
	
	scheduledTime, err := parseTime(scheduledTimeStr)
	if err != nil {
		return nil, err
	}
	
	var existing models.TaskRecovery
	err = db.Where("task_name = ? AND DATE(scheduled_time) = DATE(?)", taskName, scheduledTime).
		First(&existing).Error
	
	if err == nil {
		return nil, errors.New("该任务的漏跑记录已存在")
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	
	req := CreateTaskRequest{
		TaskName:      taskName,
		ScheduledTime: scheduledTimeStr,
		MissReason:    models.ReasonUnknown,
		CreatedBy:     operator,
		Remarks:       "系统自动检测到漏跑",
		OriginalInput: fmt.Sprintf("自动检测: task_name=%s, scheduled_time=%s", taskName, scheduledTimeStr),
	}
	
	task, err := CreateTask(req)
	if err != nil {
		return nil, err
	}
	
	_, err = UpdateStatus(UpdateStatusRequest{
		ID:             task.ID,
		ToStatus:       models.StatusDetected,
		Operator:       operator,
		ProcessingNote: "自动检测标记为漏跑",
		Action:         "AUTO_DETECT",
	})
	
	if err != nil {
		return nil, err
	}
	
	return GetTaskByID(task.ID)
}
