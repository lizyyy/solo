package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"client-capability-negotiation/internal/model"
	"client-capability-negotiation/internal/service"
	"client-capability-negotiation/internal/storage"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *service.NegotiationService
}

func NewHandler(svc *service.NegotiationService) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		clients := api.Group("/clients")
		{
			clients.POST("", h.CreateClient)
			clients.GET("", h.ListClients)
			clients.GET("/:id", h.GetClient)
			clients.GET("/:id/declarations", h.GetClientDeclarations)
			clients.GET("/:id/negotiations", h.GetClientNegotiations)
			clients.GET("/:id/hitlogs", h.GetClientHitLogs)
		}

		declarations := api.Group("/declarations")
		{
			declarations.POST("", h.CreateDeclaration)
			declarations.GET("/:id", h.GetDeclaration)
			declarations.POST("/:id/negotiate", h.Negotiate)
		}

		negotiations := api.Group("/negotiations")
		{
			negotiations.GET("", h.ListNegotiations)
			negotiations.GET("/verify/:clientID/:declarationID", h.VerifyNegotiation)
			negotiations.GET("/:id", h.GetNegotiation)
			negotiations.POST("/:id/status", h.UpdateStatus)
			negotiations.GET("/:id/transitions", h.GetStatusTransitions)
			negotiations.GET("/:id/hitlogs", h.GetHitLogs)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}

func (h *Handler) CreateClient(c *gin.Context) {
	var req struct {
		ClientID    string `json:"client_id" binding:"required"`
		ClientName  string `json:"client_name" binding:"required"`
		ClientType  string `json:"client_type" binding:"required"`
		CreatedBy   string `json:"created_by" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}

	client, err := h.service.CreateClient(req.ClientID, req.ClientName, req.ClientType, req.CreatedBy, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "CREATE_FAILED",
			Message: "Failed to create client",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, model.SuccessResponse{
		Success: true,
		Data:    client,
	})
}

func (h *Handler) ListClients(c *gin.Context) {
	clients, err := h.service.ListClients()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to list clients",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    clients,
	})
}

func (h *Handler) GetClient(c *gin.Context) {
	clientID := c.Param("id")

	client, err := h.service.GetClient(clientID)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "Client not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "GET_FAILED",
			Message: "Failed to get client",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    client,
	})
}

func (h *Handler) GetClientDeclarations(c *gin.Context) {
	clientID := c.Param("id")

	declarations, err := h.service.GetDeclarationsByClient(clientID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to get declarations",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    declarations,
	})
}

func (h *Handler) GetClientNegotiations(c *gin.Context) {
	clientID := c.Param("id")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))

	var statusPtr *model.NegotiationStatus
	if status != "" {
		s := model.NegotiationStatus(strings.ToUpper(status))
		statusPtr = &s
	}

	results, err := h.service.ListNegotiationResults(clientID, statusPtr, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to get negotiations",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    results,
	})
}

func (h *Handler) GetClientHitLogs(c *gin.Context) {
	clientID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	logs, err := h.service.GetHitLogsByClient(clientID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to get hit logs",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    logs,
	})
}

func (h *Handler) CreateDeclaration(c *gin.Context) {
	var req model.CreateDeclarationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}

	declaration, err := h.service.CreateDeclaration(&req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "CLIENT_NOT_FOUND",
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "CREATE_FAILED",
			Message: "Failed to create declaration",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, model.SuccessResponse{
		Success: true,
		Data:    declaration,
	})
}

func (h *Handler) GetDeclaration(c *gin.Context) {
	id := c.Param("id")

	declaration, err := h.service.GetDeclaration(id)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "Declaration not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "GET_FAILED",
			Message: "Failed to get declaration",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    declaration,
	})
}

func (h *Handler) Negotiate(c *gin.Context) {
	declarationID := c.Param("id")
	var req model.NegotiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}
	req.DeclarationID = declarationID

	result, err := h.service.Negotiate(&req)
	if err != nil {
		if errors.Is(err, service.ErrDeclarationExists) {
			c.JSON(http.StatusConflict, model.ErrorResponse{
				Code:    "ALREADY_EXISTS",
				Message: err.Error(),
				Detail:  "Negotiation result already exists for this declaration, duplicate submission prevented",
			})
			return
		}
		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "Declaration not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "NEGOTIATION_FAILED",
			Message: "Failed to negotiate",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    result,
		Message: "Negotiation completed successfully",
	})
}

func (h *Handler) ListNegotiations(c *gin.Context) {
	clientID := c.Query("client_id")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))

	var statusPtr *model.NegotiationStatus
	if status != "" {
		s := model.NegotiationStatus(strings.ToUpper(status))
		statusPtr = &s
	}

	results, err := h.service.ListNegotiationResults(clientID, statusPtr, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to list negotiations",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    results,
	})
}

func (h *Handler) GetNegotiation(c *gin.Context) {
	id := c.Param("id")

	result, err := h.service.GetNegotiationResult(id)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "Negotiation not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "GET_FAILED",
			Message: "Failed to get negotiation",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    result,
	})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	resultID := c.Param("id")
	var req model.StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "Invalid request body",
			Detail:  err.Error(),
		})
		return
	}
	req.ResultID = resultID

	result, err := h.service.UpdateStatus(&req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidStatus) {
			c.JSON(http.StatusBadRequest, model.ErrorResponse{
				Code:    "INVALID_STATUS_TRANSITION",
				Message: err.Error(),
			})
			return
		}
		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "Negotiation not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "UPDATE_FAILED",
			Message: "Failed to update status",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    result,
		Message: "Status updated successfully",
	})
}

func (h *Handler) GetStatusTransitions(c *gin.Context) {
	resultID := c.Param("id")

	transitions, err := h.service.GetStatusTransitions(resultID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to get status transitions",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    transitions,
	})
}

func (h *Handler) GetHitLogs(c *gin.Context) {
	resultID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	logs, err := h.service.GetHitLogs(resultID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "LIST_FAILED",
			Message: "Failed to get hit logs",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    logs,
	})
}

func (h *Handler) VerifyNegotiation(c *gin.Context) {
	clientID := c.Param("clientID")
	declarationID := c.Param("declarationID")

	result, err := h.service.VerifyNegotiation(clientID, declarationID)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "Negotiation not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "VERIFY_FAILED",
			Message: "Verification failed",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.SuccessResponse{
		Success: true,
		Data:    result,
	})
}
