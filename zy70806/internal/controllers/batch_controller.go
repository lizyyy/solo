package controllers

import (
	"net/http"
	"strconv"

	"customs-reconciliation/internal/models"
	"customs-reconciliation/internal/repository"
	"customs-reconciliation/internal/services"

	"github.com/gin-gonic/gin"
)

type BatchController struct {
	batchRepo *repository.ReconciliationBatchRepository
}

func NewBatchController() *BatchController {
	return &BatchController{
		batchRepo: repository.NewReconciliationBatchRepository(),
	}
}

func (c *BatchController) CreateBatch(ctx *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch := &models.ReconciliationBatch{
		Name:   req.Name,
		Status: models.BatchStatusPending,
	}

	if err := c.batchRepo.Create(batch); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, batch)
}

func (c *BatchController) ListBatches(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "20"))

	batches, total, err := c.batchRepo.List(page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data":  batches,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func (c *BatchController) GetBatch(ctx *gin.Context) {
	batchID := ctx.Param("id")

	batch, err := c.batchRepo.GetByID(batchID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	ctx.JSON(http.StatusOK, batch)
}

func (c *BatchController) ProcessBatch(ctx *gin.Context) {
	batchID := ctx.Param("id")

	reconciliationService := services.NewReconciliationService()
	result, err := reconciliationService.ProcessBatch(batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *BatchController) GetBatchItems(ctx *gin.Context) {
	batchID := ctx.Param("id")

	reconciliationService := services.NewReconciliationService()
	items, err := reconciliationService.GetBatchItems(batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, items)
}

func (c *BatchController) GetBatchDiscrepancies(ctx *gin.Context) {
	batchID := ctx.Param("id")

	reconciliationService := services.NewReconciliationService()
	discrepancies, err := reconciliationService.GetBatchDiscrepancies(batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, discrepancies)
}

func (c *BatchController) GetCategorySummary(ctx *gin.Context) {
	batchID := ctx.Param("id")

	reconciliationService := services.NewReconciliationService()
	summary, err := reconciliationService.GetCategorySummary(batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, summary)
}

func (c *BatchController) GetCurrencySummary(ctx *gin.Context) {
	batchID := ctx.Param("id")

	reconciliationService := services.NewReconciliationService()
	summary, err := reconciliationService.GetCurrencySummary(batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, summary)
}
