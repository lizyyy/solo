package api

import (
	"config-center-service/internal/model"
	"config-center-service/internal/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

type RollbackHandler struct {
	service *service.RollbackService
}

func NewRollbackHandler() *RollbackHandler {
	return &RollbackHandler{
		service: service.NewRollbackService(),
	}
}

type CreateRollbackRequest struct {
	AppName           string            `json:"app_name" binding:"required"`
	ConfigKey         string            `json:"config_key" binding:"required"`
	TargetVersion     int64             `json:"target_version" binding:"required,min=1"`
	SourceVersion     int64             `json:"source_version" binding:"required,min=1"`
	Confirmer         string            `json:"confirmer" binding:"required"`
	InstanceScopeType model.InstanceScopeType `json:"instance_scope_type" binding:"required"`
	InstanceIDs       []string          `json:"instance_ids"`
	GrayGroupID       string            `json:"gray_group_id"`
	Remark            string            `json:"remark"`
}

type ConfirmRollbackRequest struct {
	Operator string `json:"operator" binding:"required"`
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *RollbackHandler) CreateRollback(c *gin.Context) {
	var req CreateRollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Code:    400,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	serviceReq := &service.CreateRollbackRequest{
		AppName:           req.AppName,
		ConfigKey:         req.ConfigKey,
		TargetVersion:     req.TargetVersion,
		SourceVersion:     req.SourceVersion,
		Confirmer:         req.Confirmer,
		InstanceScopeType: req.InstanceScopeType,
		InstanceIDs:       req.InstanceIDs,
		GrayGroupID:       req.GrayGroupID,
		Remark:            req.Remark,
	}

	rc, err := h.service.CreateRollback(serviceReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Code:    500,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "创建成功",
		Data:    rc,
	})
}

func (h *RollbackHandler) ConfirmRollback(c *gin.Context) {
	id := c.Param("id")
	var req ConfirmRollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Code:    400,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	rc, err := h.service.ConfirmRollback(id, req.Operator)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "确认成功",
		Data:    rc,
	})
}

func (h *RollbackHandler) ExecuteRollback(c *gin.Context) {
	id := c.Param("id")

	rc, err := h.service.ExecuteRollback(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "执行成功",
		Data:    rc,
	})
}

func (h *RollbackHandler) GetRollbackDetail(c *gin.Context) {
	id := c.Param("id")

	rc, err := h.service.GetRollbackDetail(id)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Code:    404,
			Message: "记录不存在",
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "查询成功",
		Data:    rc,
	})
}

func (h *RollbackHandler) ListRollbacks(c *gin.Context) {
	appName := c.Query("app_name")
	if appName == "" {
		c.JSON(http.StatusBadRequest, Response{
			Code:    400,
			Message: "app_name不能为空",
		})
		return
	}

	list, err := h.service.ListRollbacks(appName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Code:    500,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "查询成功",
		Data:    list,
	})
}

func (h *RollbackHandler) GetMismatchedInstances(c *gin.Context) {
	id := c.Param("id")

	instances, err := h.service.GetMismatchedInstances(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Code:    500,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "查询成功",
		Data:    instances,
	})
}

func (h *RollbackHandler) RecordInstancePull(c *gin.Context) {
	var req struct {
		InstanceID string `json:"instance_id" binding:"required"`
		AppName    string `json:"app_name" binding:"required"`
		ConfigKey  string `json:"config_key" binding:"required"`
		Version    int64  `json:"version" binding:"required"`
		ReleaseID  string `json:"release_id"`
		RollbackID string `json:"rollback_id"`
		IsGray     bool   `json:"is_gray"`
		IsOffline  bool   `json:"is_offline"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Code:    400,
			Message: "参数错误: " + err.Error(),
		})
		return
	}

	err := h.service.RecordInstancePull(
		req.InstanceID,
		req.AppName,
		req.ConfigKey,
		req.Version,
		req.ReleaseID,
		req.RollbackID,
		req.IsGray,
		req.IsOffline,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Code:    500,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Code:    200,
		Message: "记录成功",
	})
}
