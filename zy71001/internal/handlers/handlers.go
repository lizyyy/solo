package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"crew-compensation-api/internal/models"
	"crew-compensation-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	db                *sql.DB
	validationService *services.ValidationService
	statusService     *services.StatusService
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{
		db:                db,
		validationService: services.NewValidationService(db),
		statusService:     services.NewStatusService(db),
	}
}

func (h *Handler) CreateApplication(c *gin.Context) {
	var req models.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	idempotencyKey := h.validationService.GenerateIdempotencyKey(req.CrewID, req.FlightNo, req.FlightDate)
	exists, existingID, err := h.validationService.CheckIdempotency(idempotencyKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "application already exists", "application_id": existingID})
		return
	}

	isCrossBase := false
	restHours, restPassed := h.validationService.CheckRestHours(req.ArrivalTime, time.Now())
	matchScore := h.validationService.CalculateMatchScore(&req)

	appID := uuid.New().String()
	now := time.Now()

	query := "INSERT INTO applications (id, crew_id, flight_no, flight_date, departure_time, arrival_time, delay_minutes, compensation_type, compensation_hours, status, idempotency_key, is_cross_base, rest_hours_after_landing, rest_check_passed, match_score, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	_, err = h.db.Exec(query, appID, req.CrewID, req.FlightNo, req.FlightDate, req.DepartureTime, req.ArrivalTime, req.DelayMinutes, req.CompensationType, req.CompensationHours, services.StatusPending, idempotencyKey, isCrossBase, restHours, restPassed, matchScore, req.Remarks, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":              appID,
		"status":          services.StatusPending,
		"idempotency_key": idempotencyKey,
		"is_cross_base":   isCrossBase,
		"rest_check":      gin.H{"hours_since_landing": restHours, "passed": restPassed},
		"match_score":     matchScore,
	})
}

func (h *Handler) GetApplication(c *gin.Context) {
	id := c.Param("id")
	query := "SELECT id, crew_id, flight_no, flight_date, status, created_at FROM applications WHERE id = ?"
	var app models.Application
	err := h.db.QueryRow(query, id).Scan(&app.ID, &app.CrewID, &app.FlightNo, &app.FlightDate, &app.Status, &app.CreatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, app)
}

func (h *Handler) ListApplications(c *gin.Context) {
	crewID := c.Query("crew_id")
	status := c.Query("status")
	query := "SELECT id, crew_id, flight_no, flight_date, compensation_type, compensation_hours, status, created_at FROM applications WHERE 1=1"
	args := []interface{}{}
	if crewID != "" {
		query += " AND crew_id = ?"
		args = append(args, crewID)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC"
	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var apps []gin.H
	for rows.Next() {
		var id, cid, fno, fdate, ctype, status string
		var chours float64
		var createdAt time.Time
		err := rows.Scan(&id, &cid, &fno, &fdate, &ctype, &chours, &status, &createdAt)
		if err != nil {
			continue
		}
		apps = append(apps, gin.H{"id": id, "crew_id": cid, "flight_no": fno, "flight_date": fdate, "compensation_type": ctype, "compensation_hours": chours, "status": status, "created_at": createdAt})
	}
	c.JSON(http.StatusOK, apps)
}

func (h *Handler) LeaderApprove(c *gin.Context) {
	id := c.Param("id")
	var req models.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	err := h.statusService.ApproveByLeader(id, req.ApproverID, req.ApproverName, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "approved by leader", "status": services.StatusLeaderApproved})
}

func (h *Handler) SupervisorApprove(c *gin.Context) {
	id := c.Param("id")
	var req models.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	err := h.statusService.ApproveBySupervisor(id, req.ApproverID, req.ApproverName, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "approved by supervisor", "status": services.StatusSupervisorApproved})
}

func (h *Handler) FinalApprove(c *gin.Context) {
	id := c.Param("id")
	var req models.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	err := h.statusService.FinalApprove(id, req.ApproverID, req.ApproverName, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "finally approved", "status": services.StatusApproved})
}

func (h *Handler) Reject(c *gin.Context) {
	id := c.Param("id")
	var req models.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	err := h.statusService.Reject(id, req.ApproverID, req.ApproverName, req.RejectReason, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "rejected", "status": services.StatusRejected})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now()})
}
