package services

import (
	"elderly-meal-api/internal/models"
	"elderly-meal-api/internal/repository"
	appErrors "elderly-meal-api/pkg/errors"
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"
)

type ElderlyService interface {
	Create(id, name, phone, address, healthNote, contactName, contactPhone string) (*models.Elderly, error)
	GetByID(id string) (*models.Elderly, error)
	List() ([]*models.Elderly, error)
}

type VolunteerService interface {
	Create(id, name, phone, area string) (*models.Volunteer, error)
	GetByID(id string) (*models.Volunteer, error)
	List() ([]*models.Volunteer, error)
}

type MealSuspensionService interface {
	Create(elderlyID, startDate, endDate, reason, requestedBy string) (*models.MealSuspension, error)
	Approve(id, reviewedBy string) (*models.MealSuspension, error)
	Reject(id, reviewedBy string) (*models.MealSuspension, error)
	GetByID(id string) (*models.MealSuspension, error)
	ListByElderly(elderlyID string) ([]*models.MealSuspension, error)
}

type DeliveryRouteService interface {
	Create(requestID, elderlyID, date, notes string) (*models.DeliveryRoute, error)
	Assign(routeID, volunteerID string) (*models.DeliveryRoute, error)
	StartDelivery(routeID string) (*models.DeliveryRoute, error)
	CompleteDelivery(routeID string) (*models.DeliveryRoute, error)
	MarkException(routeID, notes string) (*models.DeliveryRoute, error)
	GetByID(id string) (*models.DeliveryRoute, error)
	GetByRequestID(requestID string) (*models.DeliveryRoute, error)
	ListByDate(date string) ([]*models.DeliveryRoute, error)
	ListByVolunteerAndDate(volunteerID, date string) ([]*models.DeliveryRoute, error)
}

type SafetyVisitService interface {
	Create(routeID string, result models.VisitResult, evidenceURL, notes string) (*models.SafetyVisit, error)
	AddEvidence(visitID, evidenceURL string) (*models.SafetyVisit, error)
	MarkFollowUpComplete(visitID, followedBy string) (*models.SafetyVisit, error)
	GetByID(id string) (*models.SafetyVisit, error)
	GetByRouteID(routeID string) (*models.SafetyVisit, error)
	ListPendingFollowUps() ([]*models.SafetyVisit, error)
}

type ReportService interface {
	GenerateDailyReport(date string) (*models.ServiceReport, error)
	GetDailyReport(date string) (*models.ServiceReport, error)
	ExportToExcel(date string) ([]byte, error)
}

type elderlyService struct {
	repo repository.ElderlyRepository
}

type volunteerService struct {
	repo repository.VolunteerRepository
}

type mealSuspensionService struct {
	repo repository.MealSuspensionRepository
}

type deliveryRouteService struct {
	repo           repository.DeliveryRouteRepository
	suspensionRepo repository.MealSuspensionRepository
	elderlyRepo    repository.ElderlyRepository
}

type safetyVisitService struct {
	repo      repository.SafetyVisitRepository
	routeRepo repository.DeliveryRouteRepository
}

type reportService struct {
	routeRepo     repository.DeliveryRouteRepository
	visitRepo     repository.SafetyVisitRepository
	reportRepo    repository.ServiceReportRepository
	elderlyRepo   repository.ElderlyRepository
	volunteerRepo repository.VolunteerRepository
}

func NewElderlyService() ElderlyService {
	return &elderlyService{repo: repository.NewElderlyRepository()}
}

func NewVolunteerService() VolunteerService {
	return &volunteerService{repo: repository.NewVolunteerRepository()}
}

func NewMealSuspensionService() MealSuspensionService {
	return &mealSuspensionService{repo: repository.NewMealSuspensionRepository()}
}

func NewDeliveryRouteService() DeliveryRouteService {
	return &deliveryRouteService{
		repo:           repository.NewDeliveryRouteRepository(),
		suspensionRepo: repository.NewMealSuspensionRepository(),
		elderlyRepo:    repository.NewElderlyRepository(),
	}
}

func NewSafetyVisitService() SafetyVisitService {
	return &safetyVisitService{
		repo:      repository.NewSafetyVisitRepository(),
		routeRepo: repository.NewDeliveryRouteRepository(),
	}
}

func NewReportService() ReportService {
	return &reportService{
		routeRepo:     repository.NewDeliveryRouteRepository(),
		visitRepo:     repository.NewSafetyVisitRepository(),
		reportRepo:    repository.NewServiceReportRepository(),
		elderlyRepo:   repository.NewElderlyRepository(),
		volunteerRepo: repository.NewVolunteerRepository(),
	}
}

func (s *elderlyService) Create(id, name, phone, address, healthNote, contactName, contactPhone string) (*models.Elderly, error) {
	if name == "" {
		return nil, appErrors.NewMissingField("name")
	}
	if phone == "" {
		return nil, appErrors.NewMissingField("phone")
	}
	if address == "" {
		return nil, appErrors.NewMissingField("address")
	}
	if contactName == "" {
		return nil, appErrors.NewMissingField("contact_name")
	}
	if contactPhone == "" {
		return nil, appErrors.NewMissingField("contact_phone")
	}

	if id != "" {
		existing, err := s.repo.GetByID(id)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, appErrors.NewDuplicateRequest(id)
		}
	}

	existingByPhone, err := s.repo.GetByPhone(phone)
	if err != nil {
		return nil, err
	}
	if existingByPhone != nil {
		return existingByPhone, appErrors.NewDuplicateRequest(phone)
	}

	e := models.NewElderly()
	if id != "" {
		e.ID = id
	}
	e.Name = name
	e.Phone = phone
	e.Address = address
	e.HealthNote = healthNote
	e.ContactName = contactName
	e.ContactPhone = contactPhone

	if err := s.repo.Create(e); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *elderlyService) GetByID(id string) (*models.Elderly, error) {
	return s.repo.GetByID(id)
}

func (s *elderlyService) List() ([]*models.Elderly, error) {
	return s.repo.List()
}

func (s *volunteerService) Create(id, name, phone, area string) (*models.Volunteer, error) {
	if name == "" {
		return nil, appErrors.NewMissingField("name")
	}
	if phone == "" {
		return nil, appErrors.NewMissingField("phone")
	}
	if area == "" {
		return nil, appErrors.NewMissingField("area")
	}

	if id != "" {
		existing, err := s.repo.GetByID(id)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, appErrors.NewDuplicateRequest(id)
		}
	}

	existingByPhone, err := s.repo.GetByPhone(phone)
	if err != nil {
		return nil, err
	}
	if existingByPhone != nil {
		return existingByPhone, appErrors.NewDuplicateRequest(phone)
	}

	v := models.NewVolunteer()
	if id != "" {
		v.ID = id
	}
	v.Name = name
	v.Phone = phone
	v.Area = area

	if err := s.repo.Create(v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *volunteerService) GetByID(id string) (*models.Volunteer, error) {
	return s.repo.GetByID(id)
}

func (s *volunteerService) List() ([]*models.Volunteer, error) {
	return s.repo.List()
}

func (s *mealSuspensionService) Create(elderlyID, startDate, endDate, reason, requestedBy string) (*models.MealSuspension, error) {
	if elderlyID == "" {
		return nil, appErrors.NewMissingField("elderly_id")
	}
	if startDate == "" {
		return nil, appErrors.NewMissingField("start_date")
	}
	if endDate == "" {
		return nil, appErrors.NewMissingField("end_date")
	}
	if reason == "" {
		return nil, appErrors.NewMissingField("reason")
	}
	if requestedBy == "" {
		return nil, appErrors.NewMissingField("requested_by")
	}

	ms := models.NewMealSuspension()
	ms.ElderlyID = elderlyID
	ms.StartDate = startDate
	ms.EndDate = endDate
	ms.Reason = reason
	ms.RequestedBy = requestedBy

	if err := s.repo.Create(ms); err != nil {
		return nil, err
	}
	return ms, nil
}

func (s *mealSuspensionService) Approve(id, reviewedBy string) (*models.MealSuspension, error) {
	ms, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if ms == nil {
		return nil, appErrors.NewNotFound("meal_suspension")
	}
	if ms.Status != models.SuspensionPending {
		return nil, appErrors.NewInvalidState(string(ms.Status), string(models.SuspensionPending))
	}

	now := time.Now()
	ms.Status = models.SuspensionApproved
	ms.ReviewedBy = reviewedBy
	ms.ReviewedAt = &now

	if err := s.repo.Update(ms); err != nil {
		return nil, err
	}
	return ms, nil
}

func (s *mealSuspensionService) Reject(id, reviewedBy string) (*models.MealSuspension, error) {
	ms, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if ms == nil {
		return nil, appErrors.NewNotFound("meal_suspension")
	}
	if ms.Status != models.SuspensionPending {
		return nil, appErrors.NewInvalidState(string(ms.Status), string(models.SuspensionPending))
	}

	now := time.Now()
	ms.Status = models.SuspensionRejected
	ms.ReviewedBy = reviewedBy
	ms.ReviewedAt = &now

	if err := s.repo.Update(ms); err != nil {
		return nil, err
	}
	return ms, nil
}

func (s *mealSuspensionService) GetByID(id string) (*models.MealSuspension, error) {
	return s.repo.GetByID(id)
}

func (s *mealSuspensionService) ListByElderly(elderlyID string) ([]*models.MealSuspension, error) {
	return s.repo.ListByElderly(elderlyID)
}

func (s *deliveryRouteService) Create(requestID, elderlyID, date, notes string) (*models.DeliveryRoute, error) {
	if requestID == "" {
		return nil, appErrors.NewMissingField("request_id")
	}
	if elderlyID == "" {
		return nil, appErrors.NewMissingField("elderly_id")
	}
	if date == "" {
		return nil, appErrors.NewMissingField("date")
	}

	existing, err := s.repo.GetByRequestID(requestID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, appErrors.NewDuplicateRequest(requestID)
	}

	elderly, err := s.elderlyRepo.GetByID(elderlyID)
	if err != nil {
		return nil, err
	}
	if elderly == nil {
		return nil, appErrors.NewNotFound("elderly")
	}

	existingByDate, err := s.repo.GetByElderlyAndDate(elderlyID, date)
	if err != nil {
		return nil, err
	}
	if existingByDate != nil {
		return existingByDate, appErrors.NewDuplicateRequest(elderlyID + "-" + date)
	}

	suspension, err := s.suspensionRepo.GetActiveSuspension(elderlyID, date)
	if err != nil {
		return nil, err
	}
	if suspension != nil {
		suspendedRoute := models.NewDeliveryRoute(requestID)
		suspendedRoute.ElderlyID = elderlyID
		suspendedRoute.Date = date
		suspendedRoute.Status = models.RouteStatusSuspended
		suspendedRoute.Notes = "自动拦截: " + suspension.Reason
		if err := s.repo.Create(suspendedRoute); err != nil {
			return nil, err
		}
		return suspendedRoute, appErrors.NewMealSuspended(elderlyID, suspension.Reason)
	}

	route := models.NewDeliveryRoute(requestID)
	route.ElderlyID = elderlyID
	route.Date = date
	route.Notes = notes

	if err := s.repo.Create(route); err != nil {
		return nil, err
	}
	return route, nil
}

func (s *deliveryRouteService) Assign(routeID, volunteerID string) (*models.DeliveryRoute, error) {
	if volunteerID == "" {
		return nil, appErrors.NewMissingField("volunteer_id")
	}

	route, err := s.repo.GetByID(routeID)
	if err != nil {
		return nil, err
	}
	if route == nil {
		return nil, appErrors.NewNotFound("delivery_route")
	}

	if route.Status != models.RouteStatusPending {
		return nil, appErrors.NewInvalidState(string(route.Status), string(models.RouteStatusPending))
	}

	route.VolunteerID = volunteerID
	route.Status = models.RouteStatusAssigned

	if err := s.repo.Update(route); err != nil {
		return nil, err
	}
	return route, nil
}

func (s *deliveryRouteService) StartDelivery(routeID string) (*models.DeliveryRoute, error) {
	route, err := s.repo.GetByID(routeID)
	if err != nil {
		return nil, err
	}
	if route == nil {
		return nil, appErrors.NewNotFound("delivery_route")
	}

	if route.Status != models.RouteStatusAssigned {
		return nil, appErrors.NewInvalidState(string(route.Status), string(models.RouteStatusAssigned))
	}

	route.Status = models.RouteStatusDelivering

	if err := s.repo.Update(route); err != nil {
		return nil, err
	}
	return route, nil
}

func (s *deliveryRouteService) CompleteDelivery(routeID string) (*models.DeliveryRoute, error) {
	route, err := s.repo.GetByID(routeID)
	if err != nil {
		return nil, err
	}
	if route == nil {
		return nil, appErrors.NewNotFound("delivery_route")
	}

	if route.Status != models.RouteStatusDelivering {
		return nil, appErrors.NewInvalidState(string(route.Status), string(models.RouteStatusDelivering))
	}

	route.Status = models.RouteStatusCompleted

	if err := s.repo.Update(route); err != nil {
		return nil, err
	}
	return route, nil
}

func (s *deliveryRouteService) MarkException(routeID, notes string) (*models.DeliveryRoute, error) {
	route, err := s.repo.GetByID(routeID)
	if err != nil {
		return nil, err
	}
	if route == nil {
		return nil, appErrors.NewNotFound("delivery_route")
	}

	if route.Status != models.RouteStatusDelivering {
		return nil, appErrors.NewInvalidState(string(route.Status), string(models.RouteStatusDelivering))
	}

	route.Status = models.RouteStatusException
	route.Notes = notes

	if err := s.repo.Update(route); err != nil {
		return nil, err
	}
	return route, nil
}

func (s *deliveryRouteService) GetByID(id string) (*models.DeliveryRoute, error) {
	return s.repo.GetByID(id)
}

func (s *deliveryRouteService) GetByRequestID(requestID string) (*models.DeliveryRoute, error) {
	return s.repo.GetByRequestID(requestID)
}

func (s *deliveryRouteService) ListByDate(date string) ([]*models.DeliveryRoute, error) {
	return s.repo.ListByDate(date)
}

func (s *deliveryRouteService) ListByVolunteerAndDate(volunteerID, date string) ([]*models.DeliveryRoute, error) {
	return s.repo.ListByVolunteerAndDate(volunteerID, date)
}

func (s *safetyVisitService) Create(routeID string, result models.VisitResult, evidenceURL, notes string) (*models.SafetyVisit, error) {
	if routeID == "" {
		return nil, appErrors.NewMissingField("route_id")
	}
	if result == "" {
		return nil, appErrors.NewMissingField("result")
	}

	route, err := s.routeRepo.GetByID(routeID)
	if err != nil {
		return nil, err
	}
	if route == nil {
		return nil, appErrors.NewNotFound("delivery_route")
	}

	existing, err := s.repo.GetByRouteID(routeID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, appErrors.NewDuplicateRequest(routeID)
	}

	if route.Status != models.RouteStatusDelivering && route.Status != models.RouteStatusCompleted && route.Status != models.RouteStatusException {
		return nil, appErrors.NewInvalidState(string(route.Status), "delivering/completed/exception")
	}

	visit := models.NewSafetyVisit()
	visit.RouteID = routeID
	visit.Result = result
	visit.EvidenceURL = evidenceURL
	visit.Notes = notes

	if result == models.VisitResultNoAnswer || result == models.VisitResultAbnormal {
		visit.NeedsFollowUp = true
		visit.FollowUpStatus = "pending"
	}

	if err := s.repo.Create(visit); err != nil {
		return nil, err
	}

	if result == models.VisitResultAbnormal {
		return visit, appErrors.NewNeedReview("异常安访结果，需人工跟进")
	}

	return visit, nil
}

func (s *safetyVisitService) AddEvidence(visitID, evidenceURL string) (*models.SafetyVisit, error) {
	if evidenceURL == "" {
		return nil, appErrors.NewMissingField("evidence_url")
	}

	visit, err := s.repo.GetByID(visitID)
	if err != nil {
		return nil, err
	}
	if visit == nil {
		return nil, appErrors.NewNotFound("safety_visit")
	}

	visit.EvidenceURL = evidenceURL

	if err := s.repo.Update(visit); err != nil {
		return nil, err
	}
	return visit, nil
}

func (s *safetyVisitService) MarkFollowUpComplete(visitID, followedBy string) (*models.SafetyVisit, error) {
	if followedBy == "" {
		return nil, appErrors.NewMissingField("followed_by")
	}

	visit, err := s.repo.GetByID(visitID)
	if err != nil {
		return nil, err
	}
	if visit == nil {
		return nil, appErrors.NewNotFound("safety_visit")
	}

	if !visit.NeedsFollowUp {
		return nil, appErrors.NewInvalidState("no_followup_needed", "needs_followup")
	}

	now := time.Now()
	visit.FollowUpStatus = "completed"
	visit.FollowedBy = followedBy
	visit.FollowedAt = &now

	if err := s.repo.Update(visit); err != nil {
		return nil, err
	}
	return visit, nil
}

func (s *safetyVisitService) GetByID(id string) (*models.SafetyVisit, error) {
	return s.repo.GetByID(id)
}

func (s *safetyVisitService) GetByRouteID(routeID string) (*models.SafetyVisit, error) {
	return s.repo.GetByRouteID(routeID)
}

func (s *safetyVisitService) ListPendingFollowUps() ([]*models.SafetyVisit, error) {
	return s.repo.ListPendingFollowUps()
}

func (s *reportService) GenerateDailyReport(date string) (*models.ServiceReport, error) {
	if date == "" {
		return nil, appErrors.NewMissingField("date")
	}

	routes, err := s.routeRepo.ListByDate(date)
	if err != nil {
		return nil, err
	}

	report := models.NewServiceReport()
	report.Date = date
	report.TotalDeliveries = len(routes)

	for _, route := range routes {
		switch route.Status {
		case models.RouteStatusCompleted:
			report.CompletedCount++
		case models.RouteStatusException:
			report.ExceptionCount++
		case models.RouteStatusSuspended:
			report.SuspendedCount++
		}

		visit, _ := s.visitRepo.GetByRouteID(route.ID)
		if visit != nil {
			switch visit.Result {
			case models.VisitResultNormal:
				report.NormalVisits++
			case models.VisitResultNoAnswer:
				report.NoAnswerVisits++
			case models.VisitResultAbnormal:
				report.AbnormalVisits++
			}
		}
	}

	pendingFollowUps, err := s.visitRepo.ListPendingFollowUps()
	if err != nil {
		return nil, err
	}
	report.PendingFollowUps = len(pendingFollowUps)

	if err := s.reportRepo.Upsert(report); err != nil {
		return nil, err
	}

	return report, nil
}

func (s *reportService) GetDailyReport(date string) (*models.ServiceReport, error) {
	return s.reportRepo.GetByDate(date)
}

func (s *reportService) ExportToExcel(date string) ([]byte, error) {
	report, err := s.GenerateDailyReport(date)
	if err != nil {
		return nil, err
	}

	routes, err := s.routeRepo.ListByDate(date)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	defer f.Close()

	summarySheet := "汇总"
	detailSheet := "明细"
	f.SetSheetName("Sheet1", summarySheet)
	f.NewSheet(detailSheet)

	summaryHeaders := []string{"指标", "数值"}
	for i, h := range summaryHeaders {
		cell := string(rune('A'+i)) + "1"
		f.SetCellValue(summarySheet, cell, h)
		f.SetCellStyle(summarySheet, cell, cell, s.getHeaderStyle(f))
	}

	summaryData := [][]interface{}{
		{"日期", date},
		{"总派单数", report.TotalDeliveries},
		{"已完成", report.CompletedCount},
		{"异常单", report.ExceptionCount},
		{"停餐拦截", report.SuspendedCount},
		{"正常安访", report.NormalVisits},
		{"敲门无人", report.NoAnswerVisits},
		{"异常安访", report.AbnormalVisits},
		{"待跟进回访", report.PendingFollowUps},
	}

	for i, row := range summaryData {
		for j, val := range row {
			cell := string(rune('A'+j)) + fmt.Sprint(i+2)
			f.SetCellValue(summarySheet, cell, val)
		}
	}

	f.SetColWidth(summarySheet, "A", "A", 20)
	f.SetColWidth(summarySheet, "B", "B", 20)

	detailHeaders := []string{"路线ID", "老人ID", "志愿者ID", "状态", "安访结果", "是否需跟进", "备注"}
	for i, h := range detailHeaders {
		cell := string(rune('A'+i)) + "1"
		f.SetCellValue(detailSheet, cell, h)
		f.SetCellStyle(detailSheet, cell, cell, s.getHeaderStyle(f))
	}

	for i, route := range routes {
		visit, _ := s.visitRepo.GetByRouteID(route.ID)
		visitResult := ""
		needsFollowUp := ""
		if visit != nil {
			visitResult = string(visit.Result)
			if visit.NeedsFollowUp {
				needsFollowUp = "是"
			} else {
				needsFollowUp = "否"
			}
		}

		rowData := []interface{}{
			route.ID,
			route.ElderlyID,
			route.VolunteerID,
			string(route.Status),
			visitResult,
			needsFollowUp,
			route.Notes,
		}
		for j, val := range rowData {
			cell := string(rune('A'+j)) + fmt.Sprint(i+2)
			f.SetCellValue(detailSheet, cell, val)
		}
	}

	colWidths := []float64{36, 36, 36, 12, 12, 12, 30}
	for i, w := range colWidths {
		f.SetColWidth(detailSheet, string(rune('A'+i)), string(rune('A'+i)), w)
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (s *reportService) getHeaderStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E0E0E0"},
			Pattern: 1,
		},
	})
	return style
}
