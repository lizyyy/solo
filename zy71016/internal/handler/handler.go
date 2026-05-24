package handler

import (
	"city-salt-api/internal/database"
	"city-salt-api/internal/models"
	"city-salt-api/internal/service"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func getClientIP(c *gin.Context) string {
	ip := c.ClientIP()
	return ip
}

func getOperator(c *gin.Context) string {
	operator := c.GetHeader("X-Operator")
	if operator == "" {
		operator = "system"
	}
	return operator
}

func (h *Handler) CreateDispatchBatch(c *gin.Context) {
	var req service.DispatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ip := getClientIP(c)
	resp, err := service.CreateDispatchBatch(req, ip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) StartDispatch(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	operator := getOperator(c)
	ip := getClientIP(c)

	err := service.StartDispatch(uint(id), operator, ip)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "发车成功"})
}

func (h *Handler) UpdateRouteStatus(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req struct {
		Status   string `json:"status" binding:"required"`
		Location string `json:"location"`
		Remark   string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	operator := getOperator(c)
	ip := getClientIP(c)

	err := service.UpdateRouteStatus(uint(id), req.Status, req.Location, req.Remark, operator, ip)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "状态更新成功"})
}

func (h *Handler) CancelDispatchItem(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	operator := getOperator(c)
	ip := getClientIP(c)

	err := service.CancelDispatchItem(uint(id), req.Reason, operator, ip)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "任务已取消"})
}

func (h *Handler) ConfirmReceipt(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req struct {
		ReceivedAmount float64 `json:"received_amount" binding:"required"`
		ReceiverName   string  `json:"receiver_name" binding:"required"`
		ReceiverSign   string  `json:"receiver_sign"`
		Remark         string  `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	operator := getOperator(c)
	ip := getClientIP(c)

	receipt, err := service.ConfirmReceipt(uint(id), req.ReceivedAmount, req.ReceiverName, req.ReceiverSign, req.Remark, operator, ip)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, receipt)
}

func (h *Handler) GetAnomalies(c *gin.Context) {
	batchID := c.Query("batch_id")
	var anomalies []models.DispatchItem
	var err error

	if batchID != "" {
		id, _ := strconv.ParseUint(batchID, 10, 32)
		anomalies, err = service.GetAnomalies(uint(id))
	} else {
		anomalies, err = service.GetAllAnomalies()
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, anomalies)
}

func (h *Handler) ResolveAnomaly(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req struct {
		Resolution string `json:"resolution" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	operator := getOperator(c)
	ip := getClientIP(c)

	err := service.ResolveAnomaly(uint(id), req.Resolution, operator, ip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "异常已处理"})
}

func (h *Handler) GetBatches(c *gin.Context) {
	var batches []models.DispatchBatch
	query := database.DB.Preload("WeatherLevel").Order("created_at DESC")

	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Find(&batches)
	c.JSON(http.StatusOK, batches)
}

func (h *Handler) GetBatch(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var batch models.DispatchBatch
	if err := database.DB.Preload("WeatherLevel").First(&batch, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "批次不存在"})
		return
	}

	items, _ := database.GetBatchItems(uint(id))

	c.JSON(http.StatusOK, gin.H{
		"batch": batch,
		"items": items,
	})
}

func (h *Handler) GetDispatchItem(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var item models.DispatchItem
	if err := database.DB.Preload("Vehicle").Preload("SaltDepot").Preload("RoadSection").First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) GetItemTrajectory(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	trajectory, err := service.GetItemTrajectory(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}
	c.JSON(http.StatusOK, trajectory)
}

func (h *Handler) GetBatchTrajectory(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	trajectories, err := service.GetBatchTrajectory(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "批次不存在"})
		return
	}
	c.JSON(http.StatusOK, trajectories)
}

func (h *Handler) GenerateReport(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	operator := getOperator(c)

	report, err := service.GenerateDispatchReport(uint(id), operator)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

func (h *Handler) ExportBatchCSV(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	data, err := service.ExportToCSV(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=batch_"+strconv.Itoa(int(id))+".csv")
	c.Data(http.StatusOK, "text/csv", data)
}

func (h *Handler) ExportStatsCSV(c *gin.Context) {
	data, err := service.ExportStatsCSV()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=stats_"+time.Now().Format("20060102")+".csv")
	c.Data(http.StatusOK, "text/csv", data)
}

func (h *Handler) GetStats(c *gin.Context) {
	stats, err := service.GetStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *Handler) CreateRoadClosure(c *gin.Context) {
	var req struct {
		RoadSectionID uint   `json:"road_section_id" binding:"required"`
		Reason        string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	closure := models.RoadClosure{
		RoadSectionID: req.RoadSectionID,
		Reason:        req.Reason,
		StartTime:     time.Now(),
		Status:        "active",
		CreatedBy:     getOperator(c),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := database.DB.Create(&closure).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&models.RoadSection{}).Where("id = ?", req.RoadSectionID).Update("status", "closed")

	c.JSON(http.StatusOK, closure)
}

func (h *Handler) CloseRoadClosure(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	now := time.Now()

	if err := database.DB.Model(&models.RoadClosure{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":     "closed",
		"end_time":   now,
		"updated_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var closure models.RoadClosure
	database.DB.First(&closure, id)
	database.DB.Model(&models.RoadSection{}).Where("id = ?", closure.RoadSectionID).Update("status", "normal")

	c.JSON(http.StatusOK, gin.H{"message": "封路已解除"})
}

func (h *Handler) GetRoadClosures(c *gin.Context) {
	var closures []models.RoadClosure
	query := database.DB.Preload("RoadSection").Order("created_at DESC")

	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Find(&closures)
	c.JSON(http.StatusOK, closures)
}

func (h *Handler) GetRoadSections(c *gin.Context) {
	var roads []models.RoadSection
	database.DB.Find(&roads)
	c.JSON(http.StatusOK, roads)
}

func (h *Handler) GetSaltDepots(c *gin.Context) {
	var depots []models.SaltDepot
	database.DB.Find(&depots)
	c.JSON(http.StatusOK, depots)
}

func (h *Handler) GetVehicles(c *gin.Context) {
	var vehicles []models.Vehicle
	database.DB.Find(&vehicles)
	c.JSON(http.StatusOK, vehicles)
}

func (h *Handler) GetWeatherLevels(c *gin.Context) {
	var levels []models.WeatherLevel
	database.DB.Order("level ASC").Find(&levels)
	c.JSON(http.StatusOK, levels)
}

func (h *Handler) GetStockLogs(c *gin.Context) {
	depotID := c.Query("depot_id")
	var logs []models.StockLog
	query := database.DB.Order("created_at DESC")

	if depotID != "" {
		id, _ := strconv.ParseUint(depotID, 10, 32)
		query = query.Where("salt_depot_id = ?", id)
	}

	query.Limit(100).Find(&logs)
	c.JSON(http.StatusOK, logs)
}

func (h *Handler) GetOperationLogs(c *gin.Context) {
	var logs []models.OperationLog
	query := database.DB.Order("created_at DESC")

	module := c.Query("module")
	if module != "" {
		query = query.Where("module = ?", module)
	}

	query.Limit(200).Find(&logs)
	c.JSON(http.StatusOK, logs)
}

func (h *Handler) UpdateMaterial(c *gin.Context) {
	materialType := c.Param("type")
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	operator := getOperator(c)
	ip := getClientIP(c)

	var beforeData string

	switch strings.ToLower(materialType) {
	case "roadsection":
		var road models.RoadSection
		database.DB.First(&road, id)
		before, _ := json.Marshal(road)
		beforeData = string(before)

		if err := c.ShouldBindJSON(&road); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		database.DB.Save(&road)
		after, _ := json.Marshal(road)
		database.LogOperation(operator, "update_road", "road_section", "road_section", uint(id), beforeData, string(after), ip)
		c.JSON(http.StatusOK, road)

	case "saltdepot":
		var depot models.SaltDepot
		database.DB.First(&depot, id)
		before, _ := json.Marshal(depot)
		beforeData = string(before)

		if err := c.ShouldBindJSON(&depot); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		database.DB.Save(&depot)
		after, _ := json.Marshal(depot)
		database.LogOperation(operator, "update_depot", "salt_depot", "salt_depot", uint(id), beforeData, string(after), ip)
		c.JSON(http.StatusOK, depot)

	case "vehicle":
		var vehicle models.Vehicle
		database.DB.First(&vehicle, id)
		before, _ := json.Marshal(vehicle)
		beforeData = string(before)

		if err := c.ShouldBindJSON(&vehicle); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		database.DB.Save(&vehicle)
		after, _ := json.Marshal(vehicle)
		database.LogOperation(operator, "update_vehicle", "vehicle", "vehicle", uint(id), beforeData, string(after), ip)
		c.JSON(http.StatusOK, vehicle)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的材料类型"})
	}
}

func (h *Handler) AddStock(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req struct {
		Amount float64 `json:"amount" binding:"required"`
		Remark string  `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	operator := getOperator(c)
	err := database.AddStock(uint(id), req.Amount, operator, "manual", 0, req.Remark)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "库存添加成功"})
}

func (h *Handler) GetLowStockDepots(c *gin.Context) {
	depots, err := database.CheckLowStock()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, depots)
}
