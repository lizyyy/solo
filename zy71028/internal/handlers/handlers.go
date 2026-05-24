package handlers

import (
	"elderly-meal-api/internal/models"
	"elderly-meal-api/internal/services"
	appErrors "elderly-meal-api/pkg/errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	elderlyService      services.ElderlyService
	volunteerService    services.VolunteerService
	suspensionService   services.MealSuspensionService
	routeService        services.DeliveryRouteService
	visitService        services.SafetyVisitService
	reportService       services.ReportService
}

func NewHandler() *Handler {
	return &Handler{
		elderlyService:    services.NewElderlyService(),
		volunteerService:  services.NewVolunteerService(),
		suspensionService: services.NewMealSuspensionService(),
		routeService:      services.NewDeliveryRouteService(),
		visitService:      services.NewSafetyVisitService(),
		reportService:     services.NewReportService(),
	}
}

func handleError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	status := appErrors.HTTPStatus(err)
	c.JSON(status, gin.H{"error": err.Error()})
}

func (h *Handler) CreateElderly(c *gin.Context) {
	var req struct {
		Name         string `json:"name"`
		Phone        string `json:"phone"`
		Address      string `json:"address"`
		HealthNote   string `json:"health_note"`
		ContactName  string `json:"contact_name"`
		ContactPhone string `json:"contact_phone"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	elderly, err := h.elderlyService.Create(req.Name, req.Phone, req.Address, req.HealthNote, req.ContactName, req.ContactPhone)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, elderly)
}

func (h *Handler) GetElderly(c *gin.Context) {
	id := c.Param("id")
	elderly, err := h.elderlyService.GetByID(id)
	if err != nil {
		handleError(c, err)
		return
	}
	if elderly == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "elderly not found"})
		return
	}
	c.JSON(http.StatusOK, elderly)
}

func (h *Handler) ListElderly(c *gin.Context) {
	list, err := h.elderlyService.List()
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateVolunteer(c *gin.Context) {
	var req struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
		Area  string `json:"area"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	volunteer, err := h.volunteerService.Create(req.Name, req.Phone, req.Area)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, volunteer)
}

func (h *Handler) GetVolunteer(c *gin.Context) {
	id := c.Param("id")
	volunteer, err := h.volunteerService.GetByID(id)
	if err != nil {
		handleError(c, err)
		return
	}
	if volunteer == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "volunteer not found"})
		return
	}
	c.JSON(http.StatusOK, volunteer)
}

func (h *Handler) ListVolunteers(c *gin.Context) {
	list, err := h.volunteerService.List()
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateSuspension(c *gin.Context) {
	var req struct {
		ElderlyID   string `json:"elderly_id"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		Reason      string `json:"reason"`
		RequestedBy string `json:"requested_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	suspension, err := h.suspensionService.Create(req.ElderlyID, req.StartDate, req.EndDate, req.Reason, req.RequestedBy)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, suspension)
}

func (h *Handler) ApproveSuspension(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ReviewedBy string `json:"reviewed_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	suspension, err := h.suspensionService.Approve(id, req.ReviewedBy)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, suspension)
}

func (h *Handler) RejectSuspension(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ReviewedBy string `json:"reviewed_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	suspension, err := h.suspensionService.Reject(id, req.ReviewedBy)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, suspension)
}

func (h *Handler) GetSuspension(c *gin.Context) {
	id := c.Param("id")
	suspension, err := h.suspensionService.GetByID(id)
	if err != nil {
		handleError(c, err)
		return
	}
	if suspension == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "suspension not found"})
		return
	}
	c.JSON(http.StatusOK, suspension)
}

func (h *Handler) ListSuspensionsByElderly(c *gin.Context) {
	elderlyID := c.Param("elderly_id")
	list, err := h.suspensionService.ListByElderly(elderlyID)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateRoute(c *gin.Context) {
	var req struct {
		RequestID string `json:"request_id"`
		ElderlyID string `json:"elderly_id"`
		Date      string `json:"date"`
		Notes     string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	route, err := h.routeService.Create(req.RequestID, req.ElderlyID, req.Date, req.Notes)
	if err != nil {
		if appErr, ok := err.(*appErrors.AppError); ok && appErr.Code == appErrors.ErrDuplicateRequest {
			c.JSON(http.StatusOK, gin.H{
				"data":    route,
				"warning": "duplicate request, returning existing record",
			})
			return
		}
		if appErr, ok := err.(*appErrors.AppError); ok && appErr.Code == appErrors.ErrSuspended {
			c.JSON(http.StatusConflict, gin.H{
				"data":  route,
				"error": err.Error(),
			})
			return
		}
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, route)
}

func (h *Handler) AssignRoute(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		VolunteerID string `json:"volunteer_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	route, err := h.routeService.Assign(id, req.VolunteerID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, route)
}

func (h *Handler) StartDelivery(c *gin.Context) {
	id := c.Param("id")
	route, err := h.routeService.StartDelivery(id)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, route)
}

func (h *Handler) CompleteDelivery(c *gin.Context) {
	id := c.Param("id")
	route, err := h.routeService.CompleteDelivery(id)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, route)
}

func (h *Handler) MarkException(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Notes string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	route, err := h.routeService.MarkException(id, req.Notes)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, route)
}

func (h *Handler) GetRoute(c *gin.Context) {
	id := c.Param("id")
	route, err := h.routeService.GetByID(id)
	if err != nil {
		handleError(c, err)
		return
	}
	if route == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		return
	}
	c.JSON(http.StatusOK, route)
}

func (h *Handler) GetRouteByRequestID(c *gin.Context) {
	requestID := c.Param("request_id")
	route, err := h.routeService.GetByRequestID(requestID)
	if err != nil {
		handleError(c, err)
		return
	}
	if route == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		return
	}
	c.JSON(http.StatusOK, route)
}

func (h *Handler) ListRoutesByDate(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date query parameter is required"})
		return
	}
	list, err := h.routeService.ListByDate(date)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) ListRoutesByVolunteerAndDate(c *gin.Context) {
	volunteerID := c.Param("volunteer_id")
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date query parameter is required"})
		return
	}
	list, err := h.routeService.ListByVolunteerAndDate(volunteerID, date)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateVisit(c *gin.Context) {
	var req struct {
		RouteID     string              `json:"route_id"`
		Result      models.VisitResult `json:"result"`
		EvidenceURL string              `json:"evidence_url"`
		Notes       string              `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visit, err := h.visitService.Create(req.RouteID, req.Result, req.EvidenceURL, req.Notes)
	if err != nil {
		if appErr, ok := err.(*appErrors.AppError); ok && appErr.Code == appErrors.ErrNeedReview {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"data":  visit,
				"error": err.Error(),
			})
			return
		}
		if appErr, ok := err.(*appErrors.AppError); ok && appErr.Code == appErrors.ErrDuplicateRequest {
			c.JSON(http.StatusOK, gin.H{
				"data":    visit,
				"warning": "duplicate request, returning existing record",
			})
			return
		}
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, visit)
}

func (h *Handler) AddEvidence(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		EvidenceURL string `json:"evidence_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visit, err := h.visitService.AddEvidence(id, req.EvidenceURL)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, visit)
}

func (h *Handler) MarkFollowUpComplete(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		FollowedBy string `json:"followed_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	visit, err := h.visitService.MarkFollowUpComplete(id, req.FollowedBy)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, visit)
}

func (h *Handler) GetVisit(c *gin.Context) {
	id := c.Param("id")
	visit, err := h.visitService.GetByID(id)
	if err != nil {
		handleError(c, err)
		return
	}
	if visit == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
		return
	}
	c.JSON(http.StatusOK, visit)
}

func (h *Handler) GetVisitByRouteID(c *gin.Context) {
	routeID := c.Param("route_id")
	visit, err := h.visitService.GetByRouteID(routeID)
	if err != nil {
		handleError(c, err)
		return
	}
	if visit == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "visit not found"})
		return
	}
	c.JSON(http.StatusOK, visit)
}

func (h *Handler) ListPendingFollowUps(c *gin.Context) {
	list, err := h.visitService.ListPendingFollowUps()
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) GenerateReport(c *gin.Context) {
	date := c.Param("date")
	report, err := h.reportService.GenerateDailyReport(date)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, report)
}

func (h *Handler) GetReport(c *gin.Context) {
	date := c.Param("date")
	report, err := h.reportService.GetDailyReport(date)
	if err != nil {
		handleError(c, err)
		return
	}
	if report == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}
	c.JSON(http.StatusOK, report)
}

func (h *Handler) ExportReport(c *gin.Context) {
	date := c.Param("date")
	data, err := h.reportService.ExportToExcel(date)
	if err != nil {
		handleError(c, err)
		return
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=meal_delivery_report_"+date+".xlsx")
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}
