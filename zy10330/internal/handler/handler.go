package handler

import (
	"net/http"

	"strategy-hotload-api/internal/model"
	"strategy-hotload-api/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *service.StrategyService
}

func NewHandler(s *service.StrategyService) *Handler {
	return &Handler{service: s}
}

func (h *Handler) CreatePackage(c *gin.Context) {
	var req model.CreatePackageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	pkg, err := h.service.CreatePackage(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(pkg))
}

func (h *Handler) GetPackage(c *gin.Context) {
	id := c.Param("id")
	pkg, err := h.service.GetPackage(id)
	if err != nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse(404, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(pkg))
}

func (h *Handler) ListPackages(c *gin.Context) {
	pkgs, err := h.service.ListPackages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(pkgs))
}

func (h *Handler) CreateRuleVersion(c *gin.Context) {
	var req model.CreateRuleVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	if err := h.service.ValidateRuleContent(req.RuleContent); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	version, err := h.service.CreateRuleVersion(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(version))
}

func (h *Handler) GetRuleVersion(c *gin.Context) {
	id := c.Param("id")
	version, err := h.service.GetRuleVersion(id)
	if err != nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse(404, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(version))
}

func (h *Handler) ListRuleVersions(c *gin.Context) {
	packageID := c.Query("package_id")
	versions, err := h.service.ListRuleVersions(packageID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(versions))
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req model.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	version, err := h.service.UpdateStatus(id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(version))
}

func (h *Handler) Rollback(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Operator string `json:"operator" binding:"required"`
		Remark   string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	version, err := h.service.Rollback(id, req.Operator, req.Remark)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(version))
}

func (h *Handler) Revoke(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Operator string `json:"operator" binding:"required"`
		Remark   string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	version, err := h.service.Revoke(id, req.Operator, req.Remark)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(version))
}

func (h *Handler) HitCheck(c *gin.Context) {
	var req model.HitCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse(400, err.Error()))
		return
	}
	result, err := h.service.HitCheck(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(result))
}

func (h *Handler) ListHitRequests(c *gin.Context) {
	packageID := c.Query("package_id")
	limit := 100
	hits, err := h.service.ListHitRequests(packageID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(hits))
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	page := 1
	pageSize := 20
	logs, total, err := h.service.ListAuditLogs(entityType, entityID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse(500, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(gin.H{
		"list":  logs,
		"total": total,
	}))
}

func (h *Handler) Export(c *gin.Context) {
	packageID := c.Query("package_id")
	result, err := h.service.Export(packageID)
	if err != nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse(404, err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.NewSuccessResponse(result))
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, model.NewSuccessResponse(gin.H{"status": "ok"}))
}
