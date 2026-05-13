package handler

import (
	"errors"
	"net/http"
	"sampling-rule-api/internal/models"
	"sampling-rule-api/internal/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CreateRule(c *gin.Context) {
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}

	rule, err := service.CreateRule(&req)
	if err != nil {
		if errors.Is(err, service.ErrDuplicateRequest) {
			c.JSON(http.StatusOK, models.SuccessResponse{
				Code:    200,
				Message: "Rule already exists (duplicate request)",
				Data:    rule,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to create rule",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Code:    201,
		Message: "Rule created successfully",
		Data:    rule,
	})
}

func ActivateRule(c *gin.Context) {
	ruleIDStr := c.Param("id")
	ruleID, err := strconv.ParseUint(ruleIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid rule ID",
			Detail:  err.Error(),
		})
		return
	}

	var req struct {
		Operator string `json:"operator" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}

	rule, err := service.ActivateRule(uint(ruleID), req.Operator)
	if err != nil {
		if errors.Is(err, service.ErrRuleNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Code:    404,
				Message: "Rule not found",
			})
			return
		}
		if errors.Is(err, service.ErrInvalidStatus) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "Invalid status transition",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to activate rule",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Rule activated successfully",
		Data:    rule,
	})
}

func ValidateRule(c *gin.Context) {
	var req models.ValidateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}

	sampled, err := service.ValidateRule(&req)
	if err != nil {
		if errors.Is(err, service.ErrRuleNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Code:    404,
				Message: "Rule not found",
			})
			return
		}
		if errors.Is(err, service.ErrRuleNotActive) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "Rule is not active",
			})
			return
		}
		if errors.Is(err, service.ErrWindowExpired) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "Sampling window has expired",
			})
			return
		}
		if errors.Is(err, service.ErrTenantNotAllowed) {
			c.JSON(http.StatusForbidden, models.ErrorResponse{
				Code:    403,
				Message: "Tenant is not allowed for this rule",
			})
			return
		}
		if errors.Is(err, service.ErrPathNotMatch) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "Path does not match rule pattern",
			})
			return
		}
		if errors.Is(err, service.ErrMaxHitsReached) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "Max hits limit reached",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to validate rule",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Validation completed",
		Data:    gin.H{"sampled": sampled},
	})
}

func UpdateRuleStatus(c *gin.Context) {
	var req models.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}

	rule, err := service.UpdateRuleStatus(&req)
	if err != nil {
		if errors.Is(err, service.ErrRuleNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Code:    404,
				Message: "Rule not found",
			})
			return
		}
		if errors.Is(err, service.ErrInvalidStatus) {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    400,
				Message: "Invalid status transition",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to update rule status",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Rule status updated successfully",
		Data:    rule,
	})
}

func GetRule(c *gin.Context) {
	ruleIDStr := c.Param("id")
	ruleID, err := strconv.ParseUint(ruleIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid rule ID",
			Detail:  err.Error(),
		})
		return
	}

	rule, err := service.GetRule(uint(ruleID))
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Code:    404,
			Message: "Rule not found",
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    rule,
	})
}

func GetAllRules(c *gin.Context) {
	rules, err := service.GetAllRules()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to get rules",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    rules,
	})
}

func GetHitRecords(c *gin.Context) {
	ruleIDStr := c.Param("id")
	ruleID, err := strconv.ParseUint(ruleIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid rule ID",
			Detail:  err.Error(),
		})
		return
	}

	records, err := service.GetHitRecords(uint(ruleID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to get hit records",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    records,
	})
}

func GetHistoryRecords(c *gin.Context) {
	ruleIDStr := c.Param("id")
	ruleID, err := strconv.ParseUint(ruleIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    400,
			Message: "Invalid rule ID",
			Detail:  err.Error(),
		})
		return
	}

	records, err := service.GetHistoryRecords(uint(ruleID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    500,
			Message: "Failed to get history records",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Code:    200,
		Message: "Success",
		Data:    records,
	})
}
