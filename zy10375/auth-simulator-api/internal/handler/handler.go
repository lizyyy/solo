package handler

import (
	"auth-simulator-api/internal/model"
	"auth-simulator-api/internal/service"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type SimulationHandler struct {
	service *service.SimulationService
}

func NewSimulationHandler(service *service.SimulationService) *SimulationHandler {
	return &SimulationHandler{service: service}
}

func (h *SimulationHandler) CreateSimulation(c *gin.Context) {
	var req model.CreateSimulationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: model.GetErrorMessage(model.ErrCodeInvalidRequest),
			Data:    err.Error(),
		})
		return
	}

	sim, err := h.service.CreateSimulation(&req)
	if err != nil {
		errCode, errMsg := parseError(err)
		status := getHTTPStatus(errCode)
		c.JSON(status, model.ApiResponse{
			Code:    status,
			Message: errMsg,
			Data:    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    sim,
	})
}

func (h *SimulationHandler) ValidateSimulation(c *gin.Context) {
	var req model.ValidateSimulationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: model.GetErrorMessage(model.ErrCodeInvalidRequest),
			Data:    err.Error(),
		})
		return
	}

	sim, err := h.service.ValidateSimulation(req.SimulationID)
	if err != nil {
		errCode, errMsg := parseError(err)
		status := getHTTPStatus(errCode)
		c.JSON(status, model.ApiResponse{
			Code:    status,
			Message: errMsg,
			Data:    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    sim,
	})
}

func (h *SimulationHandler) ActivateSimulation(c *gin.Context) {
	var req model.ActivateSimulationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: model.GetErrorMessage(model.ErrCodeInvalidRequest),
			Data:    err.Error(),
		})
		return
	}

	clientIP := c.ClientIP()
	sim, err := h.service.ActivateSimulation(req.SimulationID, clientIP)
	if err != nil {
		errCode, errMsg := parseError(err)
		status := getHTTPStatus(errCode)
		c.JSON(status, model.ApiResponse{
			Code:    status,
			Message: errMsg,
			Data:    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    sim,
	})
}

func (h *SimulationHandler) GetSimulation(c *gin.Context) {
	simID := c.Param("id")
	sim, exists := h.service.GetSimulation(simID)
	if !exists {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code:    http.StatusNotFound,
			Message: model.GetErrorMessage(model.ErrCodeSimulationNotFound),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    sim,
	})
}

func (h *SimulationHandler) QueryHistory(c *gin.Context) {
	var req model.QueryHistoryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    http.StatusBadRequest,
			Message: model.GetErrorMessage(model.ErrCodeInvalidRequest),
			Data:    err.Error(),
		})
		return
	}

	result, err := h.service.QueryHistory(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    http.StatusInternalServerError,
			Message: model.GetErrorMessage(model.ErrCodeInternalError),
			Data:    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    result,
	})
}

func (h *SimulationHandler) ExportSimulation(c *gin.Context) {
	simID := c.Param("id")
	data, err := h.service.ExportSimulation(simID)
	if err != nil {
		errCode, errMsg := parseError(err)
		status := getHTTPStatus(errCode)
		c.JSON(status, model.ApiResponse{
			Code:    status,
			Message: errMsg,
			Data:    err.Error(),
		})
		return
	}

	accept := c.GetHeader("Accept")
	if strings.Contains(accept, "application/json") || accept == "" {
		c.Header("Content-Disposition", "attachment; filename=simulation-"+simID+".json")
		c.JSON(http.StatusOK, data)
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    http.StatusOK,
		Message: "success",
		Data:    data,
	})
}

func parseError(err error) (string, string) {
	errStr := err.Error()
	parts := strings.SplitN(errStr, ":", 2)
	errCode := parts[0]
	if !isKnownErrorCode(errCode) {
		errCode = model.ErrCodeInternalError
	}
	errMsg := model.GetErrorMessage(errCode)
	return errCode, errMsg
}

func isKnownErrorCode(code string) bool {
	switch code {
	case model.ErrCodeInvalidRequest,
		model.ErrCodeIdempotencyConflict,
		model.ErrCodePartnerNotFound,
		model.ErrCodeScopeNotFound,
		model.ErrCodeSimulationNotFound,
		model.ErrCodeInvalidStatus,
		model.ErrCodeValidationFailed,
		model.ErrCodeRiskBlocked,
		model.ErrCodeCredentialExpired,
		model.ErrCodeInternalError:
		return true
	default:
		return false
	}
}

func getHTTPStatus(errCode string) int {
	switch errCode {
	case model.ErrCodeInvalidRequest,
		model.ErrCodeIdempotencyConflict,
		model.ErrCodeInvalidStatus:
		return http.StatusBadRequest
	case model.ErrCodePartnerNotFound,
		model.ErrCodeScopeNotFound,
		model.ErrCodeSimulationNotFound:
		return http.StatusNotFound
	case model.ErrCodeRiskBlocked:
		return http.StatusForbidden
	case model.ErrCodeCredentialExpired:
		return http.StatusUnauthorized
	default:
		return http.StatusInternalServerError
	}
}
