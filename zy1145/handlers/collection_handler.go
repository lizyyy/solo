package handlers

import (
	"btc-recharge-service/models"
	"btc-recharge-service/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type CollectionHandler struct {
	collectionSvc *services.CollectionService
}

func NewCollectionHandler(collectionSvc *services.CollectionService) *CollectionHandler {
	return &CollectionHandler{
		collectionSvc: collectionSvc,
	}
}

type ApproveRequest struct {
	AuditorID string `json:"auditor_id" binding:"required"`
}

type RejectRequest struct {
	AuditorID string `json:"auditor_id" binding:"required"`
	Reason    string `json:"reason" binding:"required"`
}

func (h *CollectionHandler) CreateCollectionPlan(c *gin.Context) {
	var req services.CreateCollectionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.collectionSvc.CreateCollectionPlan(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "创建归集计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *CollectionHandler) GetAllPlans(c *gin.Context) {
	plans, err := h.collectionSvc.GetAllCollectionPlans()
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询归集计划列表失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    plans,
	})
}

func (h *CollectionHandler) GetPlan(c *gin.Context) {
	planID := c.Param("plan_id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "计划 ID 不能为空",
		})
		return
	}

	resp, err := h.collectionSvc.GetCollectionPlan(planID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询归集计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *CollectionHandler) ApprovePlan(c *gin.Context) {
	planID := c.Param("plan_id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "计划 ID 不能为空",
		})
		return
	}

	var req ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.collectionSvc.ApproveCollectionPlan(planID, req.AuditorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "审核通过失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *CollectionHandler) RejectPlan(c *gin.Context) {
	planID := c.Param("plan_id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "计划 ID 不能为空",
		})
		return
	}

	var req RejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.collectionSvc.RejectCollectionPlan(planID, req.AuditorID, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "审核拒绝失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *CollectionHandler) ExecutePlan(c *gin.Context) {
	planID := c.Param("plan_id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "计划 ID 不能为空",
		})
		return
	}

	resp, err := h.collectionSvc.ExecuteCollectionPlan(planID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "执行归集计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}
