package handler

import (
	"callback-whitelist-api/internal/model"
	"callback-whitelist-api/internal/service"
	"callback-whitelist-api/internal/storage"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func respond(c *gin.Context, code int, message string, data interface{}) {
	c.JSON(code, model.ApiResponse{
		Code:    code,
		Message: message,
		Data:    data,
	})
}

func respondError(c *gin.Context, code int, err error) {
	c.JSON(code, model.ApiResponse{
		Code:    code,
		Message: err.Error(),
	})
}

func (h *Handler) CreateParty(c *gin.Context) {
	var req model.CreatePartyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	party, err := h.svc.CreateParty(&req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respond(c, http.StatusOK, "success", party)
}

func (h *Handler) GetParty(c *gin.Context) {
	id := c.Param("id")
	party, err := h.svc.GetParty(id)
	if err == storage.ErrNotFound {
		respondError(c, http.StatusNotFound, err)
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respond(c, http.StatusOK, "success", party)
}

func (h *Handler) AddSourceAddress(c *gin.Context) {
	var req model.AddSourceAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	addr, err := h.svc.AddSourceAddress(&req)
	if err == storage.ErrNotFound {
		respondError(c, http.StatusNotFound, err)
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respond(c, http.StatusOK, "success", addr)
}

func (h *Handler) CreateRule(c *gin.Context) {
	var req model.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	rule, err := h.svc.CreateRule(&req)
	if err == storage.ErrNotFound {
		respondError(c, http.StatusNotFound, err)
		return
	}
	if err == storage.ErrDuplicate {
		respond(c, http.StatusOK, "duplicate request, returning existing rule", rule)
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respond(c, http.StatusOK, "success", rule)
}

func (h *Handler) GetRule(c *gin.Context) {
	id := c.Param("id")
	rule, err := h.svc.GetRule(id)
	if err == storage.ErrNotFound {
		respondError(c, http.StatusNotFound, err)
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respond(c, http.StatusOK, "success", rule)
}

func (h *Handler) GetRulesByParty(c *gin.Context) {
	partyID := c.Query("party_id")
	rules := h.svc.GetRulesByParty(partyID)
	respond(c, http.StatusOK, "success", rules)
}

func (h *Handler) UpdateRuleStatus(c *gin.Context) {
	id := c.Param("id")
	var req model.UpdateRuleStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	rule, err := h.svc.UpdateRuleStatus(id, &req)
	if err == storage.ErrNotFound {
		respondError(c, http.StatusNotFound, err)
		return
	}
	if err == storage.ErrInvalidStatus {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respond(c, http.StatusOK, "success", rule)
}

func (h *Handler) GetRuleVersions(c *gin.Context) {
	ruleID := c.Param("id")
	versions := h.svc.GetRuleVersions(ruleID)
	respond(c, http.StatusOK, "success", versions)
}

func (h *Handler) VerifyCallback(c *gin.Context) {
	var req model.VerifyCallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	result, err := h.svc.VerifyCallback(&req)
	if err == storage.ErrNotFound {
		respondError(c, http.StatusNotFound, err)
		return
	}
	if err == storage.ErrDuplicate {
		respond(c, http.StatusOK, "duplicate request, returning existing result", result)
		return
	}
	if err != nil {
		respondError(c, http.StatusForbidden, err)
		return
	}
	respond(c, http.StatusOK, "verified", result)
}

func (h *Handler) GetRejections(c *gin.Context) {
	filter := make(map[string]interface{})
	if partyID := c.Query("party_id"); partyID != "" {
		filter["party_id"] = partyID
	}
	if ruleID := c.Query("rule_id"); ruleID != "" {
		filter["rule_id"] = ruleID
	}
	rejections := h.svc.GetRejections(filter)
	respond(c, http.StatusOK, "success", rejections)
}
