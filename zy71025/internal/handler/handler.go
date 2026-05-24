package handler

import (
	"net/http"
	"strconv"

	"irrigation-water-rights/internal/models"
	"irrigation-water-rights/internal/repository"
	"irrigation-water-rights/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	repo             *repository.Repository
	transferService  *service.WaterRightService
	irrigationService *service.IrrigationService
	reportService    *service.ReportService
}

func NewHandler(repo *repository.Repository) *Handler {
	return &Handler{
		repo:              repo,
		transferService:   service.NewWaterRightService(repo),
		irrigationService: service.NewIrrigationService(repo),
		reportService:     service.NewReportService(repo),
	}
}

func (h *Handler) CreateFarmer(c *gin.Context) {
	var farmer models.Farmer
	if err := c.ShouldBindJSON(&farmer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.repo.CreateFarmer(&farmer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建农户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "农户创建成功", "data": farmer})
}

func (h *Handler) GetFarmer(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	farmer, err := h.repo.GetFarmerByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "农户不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": farmer})
}

func (h *Handler) ListFarmers(c *gin.Context) {
	farmers, err := h.repo.ListFarmers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取农户列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": farmers})
}

func (h *Handler) CreatePlot(c *gin.Context) {
	var plot models.Plot
	if err := c.ShouldBindJSON(&plot); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	if err := h.repo.CreatePlot(&plot); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建地块失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "地块创建成功", "data": plot})
}

func (h *Handler) CreateWaterRight(c *gin.Context) {
	var wr models.WaterRight
	if err := c.ShouldBindJSON(&wr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}
	wr.Balance = wr.TotalQuota

	if err := h.repo.CreateWaterRight(&wr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建水权失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "水权创建成功", "data": wr})
}

func (h *Handler) GetWaterRight(c *gin.Context) {
	farmerID, _ := strconv.Atoi(c.Query("farmer_id"))
	year, _ := strconv.Atoi(c.Query("year"))
	week, _ := strconv.Atoi(c.Query("week"))

	wr, err := h.repo.GetWaterRight(uint(farmerID), year, week)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "水权信息不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": wr})
}

func (h *Handler) CreateTransfer(c *gin.Context) {
	var req service.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	result, err := h.transferService.CreateTransfer(req)
	if err != nil {
		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) ApproveTransfer(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Operator string `json:"operator"`
		Opinion  string `json:"opinion"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	result, err := h.transferService.ApproveTransfer(uint(id), req.Operator, req.Opinion)
	if err != nil {
		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) RevokeTransfer(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Operator string `json:"operator"`
		Reason   string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	result, err := h.transferService.RevokeTransfer(uint(id), req.Operator, req.Reason)
	if err != nil {
		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetTransfer(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	transfer, err := h.repo.GetTransferByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "转让申请不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": transfer})
}

func (h *Handler) ListTransfers(c *gin.Context) {
	filters := make(map[string]interface{})
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if year := c.Query("year"); year != "" {
		filters["year"] = year
	}
	if week := c.Query("week"); week != "" {
		filters["week"] = week
	}

	transfers, err := h.repo.ListTransfers(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取转让列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": transfers})
}

func (h *Handler) RecordIrrigation(c *gin.Context) {
	var req service.IrrigationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	result, err := h.irrigationService.RecordIrrigation(req)
	if err != nil {
		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) UpdateIrrigationEvidence(c *gin.Context) {
	recordNo := c.Param("record_no")
	var req struct {
		Evidence string `json:"evidence"`
		Operator string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	result, err := h.irrigationService.UpdateEvidence(recordNo, req.Evidence, req.Operator)
	if err != nil {
		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetIrrigation(c *gin.Context) {
	recordNo := c.Param("record_no")
	record, err := h.repo.GetIrrigationByNo(recordNo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "灌溉记录不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": record})
}

func (h *Handler) ListIrrigations(c *gin.Context) {
	filters := make(map[string]interface{})
	if farmerID := c.Query("farmer_id"); farmerID != "" {
		filters["farmer_id"] = farmerID
	}
	if year := c.Query("year"); year != "" {
		filters["year"] = year
	}
	if week := c.Query("week"); week != "" {
		filters["week"] = week
	}

	records, err := h.repo.ListIrrigationRecords(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取灌溉记录失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": records})
}

func (h *Handler) GenerateReport(c *gin.Context) {
	year, _ := strconv.Atoi(c.Query("year"))
	week, _ := strconv.Atoi(c.Query("week"))
	operator := c.Query("operator")
	if operator == "" {
		operator = "system"
	}

	result, err := h.reportService.GenerateWeeklyReport(year, week, operator)
	if err != nil {
		c.JSON(http.StatusOK, result)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetFarmerBalance(c *gin.Context) {
	farmerID, _ := strconv.Atoi(c.Param("id"))
	year, _ := strconv.Atoi(c.Query("year"))
	week, _ := strconv.Atoi(c.Query("week"))

	result, err := h.reportService.GetFarmerBalance(uint(farmerID), year, week)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func (h *Handler) SelfCheck(c *gin.Context) {
	year, _ := strconv.Atoi(c.Query("year"))
	week, _ := strconv.Atoi(c.Query("week"))

	result := h.reportService.SelfCheck(year, week)
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetChangeHistory(c *gin.Context) {
	resourceType := c.Query("resource_type")
	resourceID, _ := strconv.Atoi(c.Query("resource_id"))

	history, err := h.repo.GetChangeHistory(resourceType, uint(resourceID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取变更历史失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": history})
}
