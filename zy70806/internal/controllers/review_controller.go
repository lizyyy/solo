package controllers

import (
	"net/http"

	"customs-reconciliation/internal/services"

	"github.com/gin-gonic/gin"
)

type ReviewController struct {
	reviewService *services.ReviewService
}

func NewReviewController() *ReviewController {
	return &ReviewController{
		reviewService: services.NewReviewService(),
	}
}

func (c *ReviewController) ReviewItem(ctx *gin.Context) {
	var req services.ReviewRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := c.reviewService.ReviewItem(&req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *ReviewController) GetItemReviewHistory(ctx *gin.Context) {
	itemID := ctx.Param("id")

	history, err := c.reviewService.GetItemReviewHistory(itemID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, history)
}

func (c *ReviewController) GetItemFullTrace(ctx *gin.Context) {
	itemID := ctx.Param("id")

	trace, err := c.reviewService.GetItemFullTrace(itemID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, trace)
}

func (c *ReviewController) CompleteBatchReview(ctx *gin.Context) {
	batchID := ctx.Param("id")
	var req struct {
		Reviewer string `json:"reviewer" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := c.reviewService.CompleteBatchReview(batchID, req.Reviewer); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Batch review completed"})
}
