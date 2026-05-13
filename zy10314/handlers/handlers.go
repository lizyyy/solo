package handlers

import (
	"net/http"
	"strconv"

	"third-party-api-circuit-breaker/models"
	"third-party-api-circuit-breaker/services"
	"third-party-api-circuit-breaker/utils"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	cbService    *services.CircuitBreakerService
	dedupService *services.DeduplicationService
}

func NewHandler() *Handler {
	return &Handler{
		cbService:    services.NewCircuitBreakerService(),
		dedupService: services.NewDeduplicationService(),
	}
}

func (h *Handler) CreateExternalAPI(c *gin.Context) {
	var req CreateExternalAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	api := models.ExternalAPI{
		Name:        req.Name,
		Endpoint:    req.Endpoint,
		Method:      req.Method,
		Description: req.Description,
	}

	if err := utils.DB.Create(&api).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to create external API: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Code:    201,
		Message: "External API created successfully",
		Data:    api,
	})
}

func (h *Handler) CreateBusinessCaller(c *gin.Context) {
	var req CreateBusinessCallerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	caller := models.BusinessCaller{
		Name:        req.Name,
		SystemCode:  req.SystemCode,
		Description: req.Description,
	}

	if err := utils.DB.Create(&caller).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to create business caller: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Code:    201,
		Message: "Business caller created successfully",
		Data:    caller,
	})
}

func (h *Handler) CheckCircuit(c *gin.Context) {
	var req CheckCircuitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	isDuplicate, cachedResponse, err := h.dedupService.CheckOrRecord(req.RequestID, req.ExternalAPIID, req.BusinessCallerID, req)
	if err != nil {
		c.JSON(http.StatusConflict, ErrorResponse{
			Code:    409,
			Message: err.Error(),
		})
		return
	}

	if isDuplicate && cachedResponse != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":         200,
			"message":      "Duplicate request, returning cached response",
			"is_duplicate": true,
			"data":         cachedResponse,
		})
		return
	}

	cb, err := h.cbService.GetOrCreateCircuitBreaker(req.ExternalAPIID, req.BusinessCallerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to get circuit breaker: " + err.Error(),
		})
		return
	}

	threshold, err := h.cbService.GetThreshold(req.ExternalAPIID, req.BusinessCallerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to get threshold: " + err.Error(),
		})
		return
	}

	allowed, reason := h.cbService.IsAllowed(cb, threshold)

	response := CircuitCheckResponse{
		Allowed:          allowed,
		Reason:           reason,
		CircuitBreakerID: cb.ID,
		State:            string(cb.State),
		IsDuplicate:      isDuplicate,
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Circuit check completed",
		Data:    response,
	})
}

func (h *Handler) RecordCall(c *gin.Context) {
	var req RecordCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	result := models.CallResult(req.Result)
	if result != models.ResultSuccess && result != models.ResultFailure && result != models.ResultTimeout {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid result value, must be SUCCESS, FAILURE, or TIMEOUT",
		})
		return
	}

	cb, err := h.cbService.RecordCall(req.CircuitBreakerID, result, req.DurationMs, req.ErrorMessage, req.ResponseCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to record call: " + err.Error(),
		})
		return
	}

	if req.RequestID != "" {
		h.dedupService.MarkComplete(req.RequestID, cb)
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Call recorded successfully",
		Data:    cb,
	})
}

func (h *Handler) ManualReset(c *gin.Context) {
	var req ManualResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	cb, err := h.cbService.ManualReset(req.CircuitBreakerID, req.Operator)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to reset circuit breaker: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Circuit breaker reset successfully",
		Data:    cb,
	})
}

func (h *Handler) ForceOpen(c *gin.Context) {
	var req ForceOpenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	cb, err := h.cbService.ForceOpen(req.CircuitBreakerID, req.Operator, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to force open circuit breaker: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Circuit breaker force opened successfully",
		Data:    cb,
	})
}

func (h *Handler) GetCircuitBreaker(c *gin.Context) {
	id := c.Param("id")
	cb, err := h.cbService.GetCircuitBreakerByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    404,
			Message: "Circuit breaker not found",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    cb,
	})
}

func (h *Handler) ListCircuitBreakers(c *gin.Context) {
	cbs, err := h.cbService.GetAllCircuitBreakers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to list circuit breakers: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    cbs,
	})
}

func (h *Handler) GetHistory(c *gin.Context) {
	id := c.Param("id")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	logs, err := h.cbService.GetHistory(id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to get history: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    logs,
	})
}

func (h *Handler) ListExternalAPIs(c *gin.Context) {
	var apis []models.ExternalAPI
	if err := utils.DB.Find(&apis).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to list external APIs: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    apis,
	})
}

func (h *Handler) ListBusinessCallers(c *gin.Context) {
	var callers []models.BusinessCaller
	if err := utils.DB.Find(&callers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    500,
			Message: "Failed to list business callers: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    callers,
	})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "third-party-api-circuit-breaker",
	})
}
