package repository

import (
	"database/sql"
	"elderly-meal-api/internal/models"
	"elderly-meal-api/pkg/database"
	"time"
)

type ElderlyRepository interface {
	Create(elderly *models.Elderly) error
	GetByID(id string) (*models.Elderly, error)
	List() ([]*models.Elderly, error)
}

type VolunteerRepository interface {
	Create(volunteer *models.Volunteer) error
	GetByID(id string) (*models.Volunteer, error)
	List() ([]*models.Volunteer, error)
}

type MealSuspensionRepository interface {
	Create(suspension *models.MealSuspension) error
	GetByID(id string) (*models.MealSuspension, error)
	Update(suspension *models.MealSuspension) error
	GetActiveSuspension(elderlyID, date string) (*models.MealSuspension, error)
	ListByElderly(elderlyID string) ([]*models.MealSuspension, error)
}

type DeliveryRouteRepository interface {
	Create(route *models.DeliveryRoute) error
	GetByID(id string) (*models.DeliveryRoute, error)
	GetByRequestID(requestID string) (*models.DeliveryRoute, error)
	GetByElderlyAndDate(elderlyID, date string) (*models.DeliveryRoute, error)
	Update(route *models.DeliveryRoute) error
	ListByDate(date string) ([]*models.DeliveryRoute, error)
	ListByVolunteerAndDate(volunteerID, date string) ([]*models.DeliveryRoute, error)
}

type SafetyVisitRepository interface {
	Create(visit *models.SafetyVisit) error
	GetByID(id string) (*models.SafetyVisit, error)
	GetByRouteID(routeID string) (*models.SafetyVisit, error)
	Update(visit *models.SafetyVisit) error
	ListPendingFollowUps() ([]*models.SafetyVisit, error)
}

type ServiceReportRepository interface {
	Create(report *models.ServiceReport) error
	GetByDate(date string) (*models.ServiceReport, error)
	Upsert(report *models.ServiceReport) error
}

type elderlyRepo struct{}
type volunteerRepo struct{}
type mealSuspensionRepo struct{}
type deliveryRouteRepo struct{}
type safetyVisitRepo struct{}
type serviceReportRepo struct{}

func NewElderlyRepository() ElderlyRepository {
	return &elderlyRepo{}
}

func NewVolunteerRepository() VolunteerRepository {
	return &volunteerRepo{}
}

func NewMealSuspensionRepository() MealSuspensionRepository {
	return &mealSuspensionRepo{}
}

func NewDeliveryRouteRepository() DeliveryRouteRepository {
	return &deliveryRouteRepo{}
}

func NewSafetyVisitRepository() SafetyVisitRepository {
	return &safetyVisitRepo{}
}

func NewServiceReportRepository() ServiceReportRepository {
	return &serviceReportRepo{}
}

func (r *elderlyRepo) Create(e *models.Elderly) error {
	_, err := database.DB.Exec(`
		INSERT INTO elderly (id, name, phone, address, health_note, contact_name, contact_phone, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, e.ID, e.Name, e.Phone, e.Address, e.HealthNote, e.ContactName, e.ContactPhone, e.CreatedAt, e.UpdatedAt)
	return err
}

func (r *elderlyRepo) GetByID(id string) (*models.Elderly, error) {
	row := database.DB.QueryRow(`
		SELECT id, name, phone, address, health_note, contact_name, contact_phone, created_at, updated_at
		FROM elderly WHERE id = ?
	`, id)

	e := &models.Elderly{}
	err := row.Scan(&e.ID, &e.Name, &e.Phone, &e.Address, &e.HealthNote, &e.ContactName, &e.ContactPhone, &e.CreatedAt, &e.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return e, err
}

func (r *elderlyRepo) List() ([]*models.Elderly, error) {
	rows, err := database.DB.Query(`
		SELECT id, name, phone, address, health_note, contact_name, contact_phone, created_at, updated_at
		FROM elderly ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Elderly
	for rows.Next() {
		e := &models.Elderly{}
		err := rows.Scan(&e.ID, &e.Name, &e.Phone, &e.Address, &e.HealthNote, &e.ContactName, &e.ContactPhone, &e.CreatedAt, &e.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (r *volunteerRepo) Create(v *models.Volunteer) error {
	_, err := database.DB.Exec(`
		INSERT INTO volunteers (id, name, phone, area, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, v.ID, v.Name, v.Phone, v.Area, v.CreatedAt, v.UpdatedAt)
	return err
}

func (r *volunteerRepo) GetByID(id string) (*models.Volunteer, error) {
	row := database.DB.QueryRow(`
		SELECT id, name, phone, area, created_at, updated_at
		FROM volunteers WHERE id = ?
	`, id)

	v := &models.Volunteer{}
	err := row.Scan(&v.ID, &v.Name, &v.Phone, &v.Area, &v.CreatedAt, &v.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return v, err
}

func (r *volunteerRepo) List() ([]*models.Volunteer, error) {
	rows, err := database.DB.Query(`
		SELECT id, name, phone, area, created_at, updated_at
		FROM volunteers ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Volunteer
	for rows.Next() {
		v := &models.Volunteer{}
		err := rows.Scan(&v.ID, &v.Name, &v.Phone, &v.Area, &v.CreatedAt, &v.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, nil
}

func (r *mealSuspensionRepo) Create(s *models.MealSuspension) error {
	_, err := database.DB.Exec(`
		INSERT INTO meal_suspensions (id, elderly_id, start_date, end_date, reason, status, requested_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.ElderlyID, s.StartDate, s.EndDate, s.Reason, s.Status, s.RequestedBy, s.CreatedAt, s.UpdatedAt)
	return err
}

func (r *mealSuspensionRepo) GetByID(id string) (*models.MealSuspension, error) {
	row := database.DB.QueryRow(`
		SELECT id, elderly_id, start_date, end_date, reason, status, requested_by, reviewed_by, reviewed_at, created_at, updated_at
		FROM meal_suspensions WHERE id = ?
	`, id)

	s := &models.MealSuspension{}
	var reviewedBy sql.NullString
	err := row.Scan(&s.ID, &s.ElderlyID, &s.StartDate, &s.EndDate, &s.Reason, &s.Status, &s.RequestedBy, &reviewedBy, &s.ReviewedAt, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if reviewedBy.Valid {
		s.ReviewedBy = reviewedBy.String
	}
	return s, err
}

func (r *mealSuspensionRepo) Update(s *models.MealSuspension) error {
	s.UpdatedAt = time.Now()
	_, err := database.DB.Exec(`
		UPDATE meal_suspensions SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
		WHERE id = ?
	`, s.Status, s.ReviewedBy, s.ReviewedAt, s.UpdatedAt, s.ID)
	return err
}

func (r *mealSuspensionRepo) GetActiveSuspension(elderlyID, date string) (*models.MealSuspension, error) {
	row := database.DB.QueryRow(`
		SELECT id, elderly_id, start_date, end_date, reason, status, requested_by, reviewed_by, reviewed_at, created_at, updated_at
		FROM meal_suspensions
		WHERE elderly_id = ? AND status = ? AND start_date <= ? AND end_date >= ?
		LIMIT 1
	`, elderlyID, models.SuspensionApproved, date, date)

	s := &models.MealSuspension{}
	var reviewedBy sql.NullString
	err := row.Scan(&s.ID, &s.ElderlyID, &s.StartDate, &s.EndDate, &s.Reason, &s.Status, &s.RequestedBy, &reviewedBy, &s.ReviewedAt, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if reviewedBy.Valid {
		s.ReviewedBy = reviewedBy.String
	}
	return s, err
}

func (r *mealSuspensionRepo) ListByElderly(elderlyID string) ([]*models.MealSuspension, error) {
	rows, err := database.DB.Query(`
		SELECT id, elderly_id, start_date, end_date, reason, status, requested_by, reviewed_by, reviewed_at, created_at, updated_at
		FROM meal_suspensions WHERE elderly_id = ? ORDER BY created_at DESC
	`, elderlyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.MealSuspension
	for rows.Next() {
		s := &models.MealSuspension{}
		var reviewedBy sql.NullString
		err := rows.Scan(&s.ID, &s.ElderlyID, &s.StartDate, &s.EndDate, &s.Reason, &s.Status, &s.RequestedBy, &reviewedBy, &s.ReviewedAt, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if reviewedBy.Valid {
			s.ReviewedBy = reviewedBy.String
		}
		list = append(list, s)
	}
	return list, nil
}

func scanDeliveryRoute(row *sql.Row) (*models.DeliveryRoute, error) {
	route := &models.DeliveryRoute{}
	var volunteerID sql.NullString
	err := row.Scan(&route.ID, &route.RequestID, &route.ElderlyID, &volunteerID, &route.Date, &route.Status, &route.Notes, &route.CreatedAt, &route.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if volunteerID.Valid {
		route.VolunteerID = volunteerID.String
	}
	return route, err
}

func scanDeliveryRouteRows(rows *sql.Rows, route *models.DeliveryRoute) error {
	var volunteerID sql.NullString
	err := rows.Scan(&route.ID, &route.RequestID, &route.ElderlyID, &volunteerID, &route.Date, &route.Status, &route.Notes, &route.CreatedAt, &route.UpdatedAt)
	if volunteerID.Valid {
		route.VolunteerID = volunteerID.String
	}
	return err
}

func (r *deliveryRouteRepo) Create(route *models.DeliveryRoute) error {
	var volunteerID interface{} = nil
	if route.VolunteerID != "" {
		volunteerID = route.VolunteerID
	}

	_, err := database.DB.Exec(`
		INSERT INTO delivery_routes (id, request_id, elderly_id, volunteer_id, date, status, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, route.ID, route.RequestID, route.ElderlyID, volunteerID, route.Date, route.Status, route.Notes, route.CreatedAt, route.UpdatedAt)
	return err
}

func (r *deliveryRouteRepo) GetByID(id string) (*models.DeliveryRoute, error) {
	row := database.DB.QueryRow(`
		SELECT id, request_id, elderly_id, volunteer_id, date, status, notes, created_at, updated_at
		FROM delivery_routes WHERE id = ?
	`, id)
	return scanDeliveryRoute(row)
}

func (r *deliveryRouteRepo) GetByRequestID(requestID string) (*models.DeliveryRoute, error) {
	row := database.DB.QueryRow(`
		SELECT id, request_id, elderly_id, volunteer_id, date, status, notes, created_at, updated_at
		FROM delivery_routes WHERE request_id = ?
	`, requestID)
	return scanDeliveryRoute(row)
}

func (r *deliveryRouteRepo) GetByElderlyAndDate(elderlyID, date string) (*models.DeliveryRoute, error) {
	row := database.DB.QueryRow(`
		SELECT id, request_id, elderly_id, volunteer_id, date, status, notes, created_at, updated_at
		FROM delivery_routes WHERE elderly_id = ? AND date = ?
		LIMIT 1
	`, elderlyID, date)
	return scanDeliveryRoute(row)
}

func (r *deliveryRouteRepo) Update(route *models.DeliveryRoute) error {
	route.UpdatedAt = time.Now()
	var volunteerID interface{} = nil
	if route.VolunteerID != "" {
		volunteerID = route.VolunteerID
	}

	_, err := database.DB.Exec(`
		UPDATE delivery_routes SET volunteer_id = ?, status = ?, notes = ?, updated_at = ?
		WHERE id = ?
	`, volunteerID, route.Status, route.Notes, route.UpdatedAt, route.ID)
	return err
}

func (r *deliveryRouteRepo) ListByDate(date string) ([]*models.DeliveryRoute, error) {
	rows, err := database.DB.Query(`
		SELECT id, request_id, elderly_id, volunteer_id, date, status, notes, created_at, updated_at
		FROM delivery_routes WHERE date = ? ORDER BY created_at
	`, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.DeliveryRoute
	for rows.Next() {
		route := &models.DeliveryRoute{}
		if err := scanDeliveryRouteRows(rows, route); err != nil {
			return nil, err
		}
		list = append(list, route)
	}
	return list, nil
}

func (r *deliveryRouteRepo) ListByVolunteerAndDate(volunteerID, date string) ([]*models.DeliveryRoute, error) {
	rows, err := database.DB.Query(`
		SELECT id, request_id, elderly_id, volunteer_id, date, status, notes, created_at, updated_at
		FROM delivery_routes WHERE volunteer_id = ? AND date = ? ORDER BY created_at
	`, volunteerID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.DeliveryRoute
	for rows.Next() {
		route := &models.DeliveryRoute{}
		if err := scanDeliveryRouteRows(rows, route); err != nil {
			return nil, err
		}
		list = append(list, route)
	}
	return list, nil
}

func scanSafetyVisit(row *sql.Row) (*models.SafetyVisit, error) {
	visit := &models.SafetyVisit{}
	var evidenceURL, notes, followUpStatus, followedBy sql.NullString
	err := row.Scan(&visit.ID, &visit.RouteID, &visit.Result, &evidenceURL, &notes, &visit.NeedsFollowUp, &followUpStatus, &followedBy, &visit.FollowedAt, &visit.CreatedAt, &visit.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if evidenceURL.Valid {
		visit.EvidenceURL = evidenceURL.String
	}
	if notes.Valid {
		visit.Notes = notes.String
	}
	if followUpStatus.Valid {
		visit.FollowUpStatus = followUpStatus.String
	}
	if followedBy.Valid {
		visit.FollowedBy = followedBy.String
	}
	return visit, err
}

func scanSafetyVisitRows(rows *sql.Rows, visit *models.SafetyVisit) error {
	var evidenceURL, notes, followUpStatus, followedBy sql.NullString
	err := rows.Scan(&visit.ID, &visit.RouteID, &visit.Result, &evidenceURL, &notes, &visit.NeedsFollowUp, &followUpStatus, &followedBy, &visit.FollowedAt, &visit.CreatedAt, &visit.UpdatedAt)
	if evidenceURL.Valid {
		visit.EvidenceURL = evidenceURL.String
	}
	if notes.Valid {
		visit.Notes = notes.String
	}
	if followUpStatus.Valid {
		visit.FollowUpStatus = followUpStatus.String
	}
	if followedBy.Valid {
		visit.FollowedBy = followedBy.String
	}
	return err
}

func (r *safetyVisitRepo) Create(visit *models.SafetyVisit) error {
	_, err := database.DB.Exec(`
		INSERT INTO safety_visits (id, route_id, result, evidence_url, notes, needs_follow_up, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, visit.ID, visit.RouteID, visit.Result, visit.EvidenceURL, visit.Notes, visit.NeedsFollowUp, visit.CreatedAt, visit.UpdatedAt)
	return err
}

func (r *safetyVisitRepo) GetByID(id string) (*models.SafetyVisit, error) {
	row := database.DB.QueryRow(`
		SELECT id, route_id, result, evidence_url, notes, needs_follow_up, follow_up_status, followed_by, followed_at, created_at, updated_at
		FROM safety_visits WHERE id = ?
	`, id)
	return scanSafetyVisit(row)
}

func (r *safetyVisitRepo) GetByRouteID(routeID string) (*models.SafetyVisit, error) {
	row := database.DB.QueryRow(`
		SELECT id, route_id, result, evidence_url, notes, needs_follow_up, follow_up_status, followed_by, followed_at, created_at, updated_at
		FROM safety_visits WHERE route_id = ?
	`, routeID)
	return scanSafetyVisit(row)
}

func (r *safetyVisitRepo) Update(visit *models.SafetyVisit) error {
	visit.UpdatedAt = time.Now()
	_, err := database.DB.Exec(`
		UPDATE safety_visits SET follow_up_status = ?, followed_by = ?, followed_at = ?, updated_at = ?
		WHERE id = ?
	`, visit.FollowUpStatus, visit.FollowedBy, visit.FollowedAt, visit.UpdatedAt, visit.ID)
	return err
}

func (r *safetyVisitRepo) ListPendingFollowUps() ([]*models.SafetyVisit, error) {
	rows, err := database.DB.Query(`
		SELECT id, route_id, result, evidence_url, notes, needs_follow_up, follow_up_status, followed_by, followed_at, created_at, updated_at
		FROM safety_visits WHERE needs_follow_up = 1 AND (follow_up_status IS NULL OR follow_up_status != 'completed')
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.SafetyVisit
	for rows.Next() {
		visit := &models.SafetyVisit{}
		if err := scanSafetyVisitRows(rows, visit); err != nil {
			return nil, err
		}
		list = append(list, visit)
	}
	return list, nil
}

func (r *serviceReportRepo) Create(report *models.ServiceReport) error {
	_, err := database.DB.Exec(`
		INSERT INTO service_reports (id, date, total_deliveries, completed_count, exception_count, suspended_count, normal_visits, no_answer_visits, abnormal_visits, pending_follow_ups, generated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, report.ID, report.Date, report.TotalDeliveries, report.CompletedCount, report.ExceptionCount, report.SuspendedCount, report.NormalVisits, report.NoAnswerVisits, report.AbnormalVisits, report.PendingFollowUps, report.GeneratedAt)
	return err
}

func (r *serviceReportRepo) GetByDate(date string) (*models.ServiceReport, error) {
	row := database.DB.QueryRow(`
		SELECT id, date, total_deliveries, completed_count, exception_count, suspended_count, normal_visits, no_answer_visits, abnormal_visits, pending_follow_ups, generated_at
		FROM service_reports WHERE date = ?
	`, date)

	report := &models.ServiceReport{}
	err := row.Scan(&report.ID, &report.Date, &report.TotalDeliveries, &report.CompletedCount, &report.ExceptionCount, &report.SuspendedCount, &report.NormalVisits, &report.NoAnswerVisits, &report.AbnormalVisits, &report.PendingFollowUps, &report.GeneratedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return report, err
}

func (r *serviceReportRepo) Upsert(report *models.ServiceReport) error {
	existing, err := r.GetByDate(report.Date)
	if err != nil {
		return err
	}
	if existing == nil {
		return r.Create(report)
	}
	_, err = database.DB.Exec(`
		UPDATE service_reports SET
			total_deliveries = ?, completed_count = ?, exception_count = ?, suspended_count = ?,
			normal_visits = ?, no_answer_visits = ?, abnormal_visits = ?, pending_follow_ups = ?,
			generated_at = ?
		WHERE date = ?
	`, report.TotalDeliveries, report.CompletedCount, report.ExceptionCount, report.SuspendedCount,
		report.NormalVisits, report.NoAnswerVisits, report.AbnormalVisits, report.PendingFollowUps,
		report.GeneratedAt, report.Date)
	return err
}
