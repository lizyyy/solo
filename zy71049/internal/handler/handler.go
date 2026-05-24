package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"print-proof-api/internal/dao"
	"print-proof-api/internal/model"
	"print-proof-api/internal/service"
)

type Handler struct {
	proofService  *service.ProofService
	reportService *service.ReportService
}

func NewHandler() *Handler {
	return &Handler{
		proofService:  service.NewProofService(),
		reportService: service.NewReportService(),
	}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func respondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func respondError(c *gin.Context, code int, message string) {
	c.JSON(code, Response{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var order model.Order
	if err := c.ShouldBindJSON(&order); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := dao.CreateOrder(&order); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, order)
}

func (h *Handler) GetOrder(c *gin.Context) {
	id := c.Param("id")
	order, err := dao.GetOrderByID(id)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	if order == nil {
		respondError(c, http.StatusNotFound, "order not found")
		return
	}
	respondSuccess(c, order)
}

func (h *Handler) ListOrders(c *gin.Context) {
	orders, err := dao.ListOrders(100, 0)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, orders)
}

func (h *Handler) CreatePaper(c *gin.Context) {
	var paper model.Paper
	if err := c.ShouldBindJSON(&paper); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := dao.CreatePaper(&paper); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, paper)
}

func (h *Handler) ListPapers(c *gin.Context) {
	papers, err := dao.ListPapers()
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, papers)
}

type SubmitMaterialRequest struct {
	OrderID   string              `json:"order_id"`
	OrderNo   string              `json:"order_no"`
	PaperID   string              `json:"paper_id"`
	Colors    []*model.ColorValue `json:"colors"`
	Notes     string              `json:"notes"`
	CreatedBy string              `json:"created_by"`
}

func (h *Handler) SubmitMaterial(c *gin.Context) {
	var req SubmitMaterialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.SubmitMaterial(&service.SubmitMaterialRequest{
		OrderID:   req.OrderID,
		OrderNo:   req.OrderNo,
		PaperID:   req.PaperID,
		Colors:    req.Colors,
		Notes:     req.Notes,
		CreatedBy: req.CreatedBy,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) SubmitVersion(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.SubmitVersion(versionID, req.Operator)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) AutoCheck(c *gin.Context) {
	versionID := c.Param("id")
	result, err := h.proofService.AutoCheck(versionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) ProcessAutoCheck(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, checkResult, err := h.proofService.ProcessAutoCheck(versionID, req.Operator)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, gin.H{
		"version":      version,
		"check_result": checkResult,
	})
}

func (h *Handler) StartReview(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.StartReview(versionID, req.Operator)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) Approve(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
		Comments string `json:"comments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.Approve(versionID, req.Operator, req.Comments)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) Reject(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
		Comments string `json:"comments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.Reject(versionID, req.Operator, req.Comments)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) RequestSupplement(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
		Comments string `json:"comments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.RequestSupplement(versionID, req.Operator, req.Comments)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

type SupplementRequest struct {
	PaperID  string              `json:"paper_id"`
	Colors   []*model.ColorValue `json:"colors"`
	Notes    string              `json:"notes"`
	Operator string              `json:"operator"`
}

func (h *Handler) Supplement(c *gin.Context) {
	versionID := c.Param("id")
	var req SupplementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.Supplement(&service.SupplementRequest{
		VersionID: versionID,
		PaperID:   req.PaperID,
		Colors:    req.Colors,
		Notes:     req.Notes,
		Operator:  req.Operator,
	})
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) Finalize(c *gin.Context) {
	versionID := c.Param("id")
	var req struct {
		Operator string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := h.proofService.Finalize(versionID, req.Operator)
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, version)
}

func (h *Handler) GetVersionDetail(c *gin.Context) {
	versionID := c.Param("id")
	detail, err := h.reportService.GetVersionDetail(versionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, detail)
}

func (h *Handler) GetVersionChanges(c *gin.Context) {
	versionID := c.Param("id")
	logs, err := dao.GetChangeLogsByVersion(versionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *Handler) GetOrderVersions(c *gin.Context) {
	orderID := c.Param("id")
	versions, err := dao.GetProofVersionsByOrder(orderID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, versions)
}

func (h *Handler) GetOrderSummary(c *gin.Context) {
	orderID := c.Param("id")
	summary, err := h.reportService.GetOrderSummary(orderID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, summary)
}

func (h *Handler) CheckCanProduce(c *gin.Context) {
	versionID := c.Param("id")
	canProduce, reason, err := h.reportService.CheckCanProduce(versionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"can_produce": canProduce,
		"reason":      reason,
	})
}

type CreateReportRequest struct {
	ProductionDate string `json:"production_date"`
	ActualQuantity int    `json:"actual_quantity"`
	Result         string `json:"result"`
	GeneratedBy    string `json:"generated_by"`
}

func (h *Handler) CreateProductionReport(c *gin.Context) {
	versionID := c.Param("id")
	var req CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	version, err := dao.GetProofVersionByID(versionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	if version == nil {
		respondError(c, http.StatusNotFound, "version not found")
		return
	}

	report, err := h.reportService.CreateReport(&service.CreateReportRequest{
		OrderID:        version.OrderID,
		ProofVersionID: versionID,
		ProductionDate: req.ProductionDate,
		ActualQuantity: req.ActualQuantity,
		Result:         req.Result,
		GeneratedBy:    req.GeneratedBy,
	})
	if err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	respondSuccess(c, report)
}

func (h *Handler) ExportVersionDetail(c *gin.Context) {
	versionID := c.Param("id")
	outputDir := "./exports"

	filepath, err := h.reportService.ExportVersionDetail(versionID, outputDir)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, gin.H{
		"filepath": filepath,
	})
}

func (h *Handler) CreateHandler(c *gin.Context) {
	var handler model.Handler
	if err := c.ShouldBindJSON(&handler); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := dao.CreateHandler(&handler); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, handler)
}

func (h *Handler) ListHandlers(c *gin.Context) {
	handlers, err := dao.ListHandlers()
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}
	respondSuccess(c, handlers)
}

func (h *Handler) GetValidActions(c *gin.Context) {
	state := c.Query("state")
	sm := service.NewStateMachine()
	actions := sm.GetValidActions(state)
	respondSuccess(c, actions)
}
