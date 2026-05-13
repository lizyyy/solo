package handlers

import (
	"net/http"
	"runtime-guardrail/models"
	"runtime-guardrail/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

type SuccessResponse struct {
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginationResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

func CreateChangeRequest(c *gin.Context) {
	var req services.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cr, err := services.CreateChangeRequest(&req)
	if err != nil {
		if err.Error() == "duplicate request: change request already exists with this request_id" {
			c.JSON(http.StatusConflict, SuccessResponse{
				Message: "Duplicate request, returning existing change request",
				Data:    cr,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create change request",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Message: "Change request created successfully",
		Data:    cr,
	})
}

func ValidateChangeRequest(c *gin.Context) {
	var req services.ValidateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cr, err := services.ValidateChangeRequest(&req)
	if err != nil {
		if err.Error() == "change request not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to validate change request",
			Message: err.Error(),
		})
		return
	}

	message := "Change request validated successfully"
	if !*cr.ValidationPassed {
		message = "Change request validation failed"
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: message,
		Data:    cr,
	})
}

func ApproveChangeRequest(c *gin.Context) {
	var req services.ApproveChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cr, err := services.ApproveChangeRequest(&req)
	if err != nil {
		if err.Error() == "change request not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to approve change request",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Change request approved successfully",
		Data:    cr,
	})
}

func ActivateChangeRequest(c *gin.Context) {
	var req services.ActivateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cr, err := services.ActivateChangeRequest(&req)
	if err != nil {
		if err.Error() == "change request not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to activate change request",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Change request activated successfully",
		Data:    cr,
	})
}

func RollbackChangeRequest(c *gin.Context) {
	var req services.RollbackChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cr, err := services.RollbackChangeRequest(&req)
	if err != nil {
		if err.Error() == "change request not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to rollback change request",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Change request rolled back successfully",
		Data:    cr,
	})
}

func RejectChangeRequest(c *gin.Context) {
	var req services.RejectChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cr, err := services.RejectChangeRequest(&req)
	if err != nil {
		if err.Error() == "change request not found" {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to reject change request",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Change request rejected successfully",
		Data:    cr,
	})
}

func GetChangeRequest(c *gin.Context) {
	id := c.Param("id")

	cr, err := services.GetChangeRequest(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error: "Change request not found",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Change request retrieved successfully",
		Data:    cr,
	})
}

func ListChangeRequests(c *gin.Context) {
	serviceName := c.Query("service_name")
	paramKey := c.Query("param_key")
	status := c.Query("status")

	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	crs, total, err := services.ListChangeRequests(serviceName, paramKey, status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to list change requests",
			Message: err.Error(),
		})
		return
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize != 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, PaginationResponse{
		Data:       crs,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	})
}

func GetAuditLogs(c *gin.Context) {
	changeRequestID := c.Param("change_request_id")

	logs, err := services.GetAuditLogs(changeRequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get audit logs",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Audit logs retrieved successfully",
		Data:    logs,
	})
}

func GetRollbackRecords(c *gin.Context) {
	changeRequestID := c.Param("change_request_id")

	records, err := services.GetRollbackRecords(changeRequestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get rollback records",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Rollback records retrieved successfully",
		Data:    records,
	})
}

func CreateCallingService(c *gin.Context) {
	var req struct {
		ServiceName string `json:"service_name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	cs, err := services.CreateCallingService(req.ServiceName, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create calling service",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Message: "Calling service created successfully",
		Data:    cs,
	})
}

func CreateParameterItem(c *gin.Context) {
	var req struct {
		ServiceName string `json:"service_name" binding:"required"`
		ParamKey    string `json:"param_key" binding:"required"`
		ParamType   string `json:"param_type" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	pi, err := services.CreateParameterItem(req.ServiceName, req.ParamKey, req.ParamType, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create parameter item",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Message: "Parameter item created successfully",
		Data:    pi,
	})
}

func CreateAllowedRange(c *gin.Context) {
	var req struct {
		ParameterItemID string `json:"parameter_item_id" binding:"required"`
		MinValue        string `json:"min_value"`
		MaxValue        string `json:"max_value"`
		EnumValues      string `json:"enum_values"`
		Pattern         string `json:"pattern"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	ar, err := services.CreateAllowedRange(req.ParameterItemID, req.MinValue, req.MaxValue, req.EnumValues, req.Pattern)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to create allowed range",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, SuccessResponse{
		Message: "Allowed range created successfully",
		Data:    ar,
	})
}

func GetEffectiveResults(c *gin.Context) {
	serviceName := c.Query("service_name")
	paramKey := c.Query("param_key")

	results, err := services.GetEffectiveResults(serviceName, paramKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get effective results",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Effective results retrieved successfully",
		Data:    results,
	})
}

func TriggerAutoRollback(c *gin.Context) {
	if err := services.CheckAndExecuteAutoRollback(); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to execute auto rollback",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Auto rollback check executed successfully",
	})
}

func ValidateValue(c *gin.Context) {
	var req struct {
		ServiceName string `json:"service_name" binding:"required"`
		ParamKey    string `json:"param_key" binding:"required"`
		Value       string `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	result, err := services.ValidateAgainstAllowedRange(req.ServiceName, req.ParamKey, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to validate value",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Message: "Validation completed",
		Data:    result,
	})
}

func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "runtime-guardrail-api",
		"timestamp": gin.H{},
	})
}
