package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gmp-simulator/backend/internal/model"
	"gorm.io/gorm"
)

// GetTimeline 获取时间线数据
func GetTimeline(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		limit := 1000
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		var events []model.Event
		var snapshots []model.QueueSnapshot

		if err := db.Where("experiment_id = ?", uint(id)).
			Order("timestamp ASC").
			Limit(limit).
			Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if err := db.Where("experiment_id = ?", uint(id)).
			Order("timestamp ASC").
			Limit(limit / 10).
			Find(&snapshots).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := model.TimelineResponse{
			ExperimentID: uint(id),
			Events:       events,
			Snapshots:    snapshots,
			StartTime:    experiment.CreatedAt,
			EndTime:      experiment.EndTime,
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetEvents 获取实验的事件列表
func GetEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var events []model.Event
		query := db.Where("experiment_id = ?", uint(id))

		if eventType := c.Query("type"); eventType != "" {
			query = query.Where("event_type = ?", eventType)
		}

		if gid := c.Query("gid"); gid != "" {
			if gidInt, err := strconv.ParseInt(gid, 10, 64); err == nil {
				query = query.Where("g_id = ?", gidInt)
			}
		}

		if pid := c.Query("pid"); pid != "" {
			if pidInt, err := strconv.ParseInt(pid, 10, 64); err == nil {
				query = query.Where("p_id = ?", pidInt)
			}
		}

		limit := 1000
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		if err := query.Order("timestamp ASC").Limit(limit).Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, events)
	}
}

// GetSnapshots 获取实验的队列快照
func GetSnapshots(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		limit := 100
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		var snapshots []model.QueueSnapshot
		if err := db.Where("experiment_id = ?", uint(id)).
			Order("timestamp ASC").
			Limit(limit).
			Find(&snapshots).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, snapshots)
	}
}

// GetStatistics 获取实验统计数据
func GetStatistics(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid experiment ID"})
			return
		}

		var stats model.StatisticsResponse
		stats.ExperimentID = uint(id)

		db.Model(&model.Event{}).Where("experiment_id = ?", uint(id)).Count(&stats.TotalEvents)
		db.Model(&model.QueueSnapshot{}).Where("experiment_id = ?", uint(id)).Count(&stats.TotalSnapshots)

		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventGCreate).Count(&stats.GCreated)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventGEnd).Count(&stats.GCompleted)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventGBlock).Count(&stats.GBlocked)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventGPreempt).Count(&stats.GPreempted)

		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventWorkStealStart).Count(&stats.WorkStealAttempts)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventWorkStealEnd).Count(&stats.WorkStealSuccess)

		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type IN ?", uint(id), []model.EventType{model.EventSyscallEnter, model.EventSyscallExit}).Count(&stats.SyscallCount)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventGCStart).Count(&stats.GCRuns)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventPGCAssist).Count(&stats.GCAssistCount)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventPreemptStart).Count(&stats.PreemptionCount)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", uint(id), model.EventSysmonPreempt).Count(&stats.SysmonPreemptions)

		c.JSON(http.StatusOK, stats)
	}
}

// GetAllEvents 获取所有事件
func GetAllEvents(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var events []model.Event
		limit := 100
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		if err := db.Order("timestamp DESC").Limit(limit).Find(&events).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, events)
	}
}

// GetEventByID 通过 ID 获取事件
func GetEventByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
			return
		}

		var event model.Event
		if err := db.First(&event, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, event)
	}
}

// GetAllSnapshots 获取所有快照
func GetAllSnapshots(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var snapshots []model.QueueSnapshot
		limit := 100
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		if err := db.Order("timestamp DESC").Limit(limit).Find(&snapshots).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, snapshots)
	}
}

// GetSnapshotByID 通过 ID 获取快照
func GetSnapshotByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid snapshot ID"})
			return
		}

		var snapshot model.QueueSnapshot
		if err := db.First(&snapshot, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Snapshot not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, snapshot)
	}
}

// HealthCheck 健康检查
func HealthCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC(),
		})
	}
}

// SystemInfo 系统信息
func SystemInfo() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"version": "1.0.0",
			"name":    "GMP Simulator API",
			"time":    time.Now().UTC(),
		})
	}
}

// GetTraceImports 获取所有 Trace 导入记录
func GetTraceImports(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var imports []model.TraceImport
		if err := db.Order("created_at DESC").Find(&imports).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, imports)
	}
}

// GetTraceImport 获取单个 Trace 导入记录
func GetTraceImport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trace import ID"})
			return
		}

		var traceImport model.TraceImport
		if err := db.First(&traceImport, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Trace import not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, traceImport)
	}
}

// ImportTrace 导入 Trace 文件（占位实现）
func ImportTrace(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
			return
		}
		defer file.Close()

		traceImport := model.TraceImport{
			FileName:    header.Filename,
			FileSize:    header.Size,
			RecordCount: 0,
			Status:      "completed",
		}

		if err := db.Create(&traceImport).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Trace imported successfully",
			"import":  traceImport,
		})
	}
}

// GetReports 获取所有报告
func GetReports(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var reports []model.Report
		if err := db.Order("created_at DESC").Find(&reports).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, reports)
	}
}

// GetReport 获取单个报告
func GetReport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
			return
		}

		var report model.Report
		if err := db.First(&report, uint(id)).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, report)
	}
}

// ExportMarkdownReport 导出 Markdown 报告
func ExportMarkdownReport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ExperimentID uint   `json:"experiment_id" binding:"required"`
			Title        string `json:"title"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, req.ExperimentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var stats model.StatisticsResponse
		stats.ExperimentID = req.ExperimentID
		db.Model(&model.Event{}).Where("experiment_id = ?", req.ExperimentID).Count(&stats.TotalEvents)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", req.ExperimentID, model.EventGCreate).Count(&stats.GCreated)
		db.Model(&model.Event{}).Where("experiment_id = ? AND event_type = ?", req.ExperimentID, model.EventGEnd).Count(&stats.GCompleted)

		statsJSON, _ := json.Marshal(stats)

		title := req.Title
		if title == "" {
			title = fmt.Sprintf("GMP Simulation Report: %s", experiment.Name)
		}

		content := fmt.Sprintf(`# GMP 调度模型仿真报告

## 实验信息

- **实验名称**: %s
- **描述**: %s
- **GOMAXPROCS**: %d
- **P 数量**: %d
- **M 数量**: %d
- **G 数量**: %d
- **状态**: %s

## 统计数据

| 指标 | 数值 |
|------|------|
| 总事件数 | %d |
| G 创建数 | %d |
| G 完成数 | %d |

## 配置详情

- **启用系统调用**: %v
- **启用网络轮询**: %v
- **启用 GC Assist**: %v
- **启用抢占**: %v

---
*报告生成时间: %s*
`,
			experiment.Name,
			experiment.Description,
			experiment.GOMAXPROCS,
			experiment.NumP,
			experiment.NumM,
			experiment.NumG,
			experiment.Status,
			stats.TotalEvents,
			stats.GCreated,
			stats.GCompleted,
			experiment.EnableSyscall,
			experiment.EnableNetpoll,
			experiment.EnableGCAssist,
			experiment.EnablePreemption,
			time.Now().Format(time.RFC3339),
		)

		report := model.Report{
			ExperimentID: req.ExperimentID,
			ReportType:   model.ReportTypeMarkdown,
			Title:        title,
			Description:  experiment.Description,
			Content:      content,
			Statistics:   string(statsJSON),
		}

		if err := db.Create(&report).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Markdown report generated",
			"report":  report,
		})
	}
}

// ExportJSONReport 导出 JSON 报告
func ExportJSONReport(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ExperimentID uint   `json:"experiment_id" binding:"required"`
			Title        string `json:"title"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var experiment model.Experiment
		if err := db.First(&experiment, req.ExperimentID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Experiment not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var events []model.Event
		db.Where("experiment_id = ?", req.ExperimentID).Order("timestamp ASC").Find(&events)

		var snapshots []model.QueueSnapshot
		db.Where("experiment_id = ?", req.ExperimentID).Order("timestamp ASC").Find(&snapshots)

		reportData := map[string]interface{}{
			"experiment": experiment,
			"events":     events,
			"snapshots":  snapshots,
			"generated_at": time.Now(),
		}

		contentJSON, _ := json.MarshalIndent(reportData, "", "  ")

		title := req.Title
		if title == "" {
			title = fmt.Sprintf("GMP Simulation Report: %s", experiment.Name)
		}

		report := model.Report{
			ExperimentID: req.ExperimentID,
			ReportType:   model.ReportTypeJSON,
			Title:        title,
			Description:  experiment.Description,
			Content:      string(contentJSON),
		}

		if err := db.Create(&report).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "JSON report generated",
			"report":  report,
		})
	}
}
