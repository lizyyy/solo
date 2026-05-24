package services

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"crew-compensation-api/internal/models"
)

type ValidationService struct {
	db *sql.DB
}

func NewValidationService(db *sql.DB) *ValidationService {
	return &ValidationService{db: db}
}

func (s *ValidationService) GenerateIdempotencyKey(crewID, flightNo, flightDate string) string {
	data := fmt.Sprintf("%s:%s:%s", crewID, flightNo, flightDate)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *ValidationService) CheckIdempotency(idempotencyKey string) (bool, *models.Application, error) {
	var app models.Application
	var leaderApprovedAt, supervisorApprovedAt, rejectedAt sql.NullTime
	query := "SELECT id, crew_id, flight_no, flight_date, status, leader_approved_by, leader_approved_at, supervisor_approved_by, supervisor_approved_at, rejected_by, rejected_at, reject_reason, created_at FROM applications WHERE idempotency_key = ? LIMIT 1"
	err := s.db.QueryRow(query, idempotencyKey).Scan(
		&app.ID, &app.CrewID, &app.FlightNo, &app.FlightDate, &app.Status,
		&app.LeaderApprovedBy, &leaderApprovedAt,
		&app.SupervisorApprovedBy, &supervisorApprovedAt,
		&app.RejectedBy, &rejectedAt, &app.RejectReason, &app.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	if leaderApprovedAt.Valid {
		app.LeaderApprovedAt = leaderApprovedAt.Time
	}
	if supervisorApprovedAt.Valid {
		app.SupervisorApprovedAt = supervisorApprovedAt.Time
	}
	if rejectedAt.Valid {
		app.RejectedAt = rejectedAt.Time
	}
	return true, &app, nil
}

func (s *ValidationService) CheckRestHours(arrivalTime, applicationTime time.Time) (float64, bool) {
	restHours := applicationTime.Sub(arrivalTime).Hours()
	return restHours, restHours >= 12.0
}

func (s *ValidationService) IsOvernightFlight(departureTime, arrivalTime time.Time) bool {
	return departureTime.Day() != arrivalTime.Day()
}

func (s *ValidationService) CheckBaseConflict(crewID, departureCity string) (bool, string, error) {
	var baseCity string
	query := "SELECT b.city FROM crew_members cm JOIN bases b ON cm.base_id = b.id WHERE cm.id = ? LIMIT 1"
	err := s.db.QueryRow(query, crewID).Scan(&baseCity)
	if err != nil {
		return false, "", err
	}
	isCrossBase := !strings.EqualFold(baseCity, departureCity)
	return isCrossBase, baseCity, nil
}

func (s *ValidationService) CalculateMatchScore(req *models.CreateApplicationRequest) float64 {
	query := "SELECT departure_city, arrival_city, departure_time, arrival_time, delay_minutes FROM flight_segments WHERE flight_no = ? AND flight_date = ? AND crew_id = ? LIMIT 1"
	var dbDepCity, dbArrCity string
	var dbDepTime, dbArrTime time.Time
	var dbDelay int
	err := s.db.QueryRow(query, req.FlightNo, req.FlightDate, req.CrewID).Scan(&dbDepCity, &dbArrCity, &dbDepTime, &dbArrTime, &dbDelay)
	if err != nil {
		return 50.0
	}
	score := 100.0
	if !req.DepartureTime.Equal(dbDepTime) {
		score -= 20
	}
	if !req.ArrivalTime.Equal(dbArrTime) {
		score -= 20
	}
	if req.DelayMinutes != dbDelay {
		score -= 10
	}
	if score < 0 {
		score = 0
	}
	return score
}
