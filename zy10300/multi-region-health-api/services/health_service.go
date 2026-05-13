package services

import (
	"errors"
	"multi-region-health-api/db"
	"multi-region-health-api/models"
	"time"
)

type HealthService struct{}

func NewHealthService() *HealthService {
	return &HealthService{}
}

func (s *HealthService) NormalizeProbeStatus(rawStatus string) models.HealthStatus {
	switch rawStatus {
	case "up", "ok", "success", "200", "201":
		return models.HealthStatusHealthy
	case "degraded", "warning", "partial", "slow":
		return models.HealthStatusDegraded
	case "down", "error", "failed", "timeout", "500", "502", "503":
		return models.HealthStatusUnhealthy
	default:
		return models.HealthStatusUnknown
	}
}

func (s *HealthService) SubmitProbeResult(serviceID, requestID, probeType, rawStatus, metrics, errorMsg string) (*models.ProbeResult, error) {
	var existing models.ProbeResult
	if err := db.GetDB().Where("request_id = ?", requestID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	normalizedStatus := s.NormalizeProbeStatus(rawStatus)

	result := &models.ProbeResult{
		ServiceID:        serviceID,
		RequestID:        requestID,
		ProbeType:        probeType,
		RawStatus:        rawStatus,
		NormalizedStatus: normalizedStatus,
		Metrics:          metrics,
		ErrorMsg:         errorMsg,
		Timestamp:        time.Now(),
	}

	if err := db.GetDB().Create(result).Error; err != nil {
		return nil, err
	}

	var service models.Service
	if err := db.GetDB().First(&service, "id = ?", serviceID).Error; err == nil {
		service.HealthStatus = normalizedStatus
		service.UpdatedAt = time.Now()
		db.GetDB().Save(&service)
	}

	return result, nil
}

func (s *HealthService) GetDependentServices(serviceID string) ([]models.Service, error) {
	var dependencies []models.Dependency
	if err := db.GetDB().Where("service_id = ?", serviceID).Find(&dependencies).Error; err != nil {
		return nil, err
	}

	var services []models.Service
	for _, dep := range dependencies {
		var svc models.Service
		if err := db.GetDB().First(&svc, "id = ?", dep.DependentServiceID).Error; err == nil {
			services = append(services, svc)
		}
	}

	return services, nil
}

func (s *HealthService) AggregateDependencyHealth(serviceID string) (models.HealthStatus, error) {
	dependencies, err := s.GetDependentServices(serviceID)
	if err != nil {
		return models.HealthStatusUnknown, err
	}

	if len(dependencies) == 0 {
		return models.HealthStatusHealthy, nil
	}

	hasUnhealthy := false
	hasDegraded := false

	for _, dep := range dependencies {
		switch dep.HealthStatus {
		case models.HealthStatusUnhealthy:
			hasUnhealthy = true
		case models.HealthStatusDegraded:
			hasDegraded = true
		}
	}

	if hasUnhealthy {
		return models.HealthStatusUnhealthy, nil
	}
	if hasDegraded {
		return models.HealthStatusDegraded, nil
	}

	return models.HealthStatusHealthy, nil
}

func (s *HealthService) TransitionDegradeStatus(serviceID, requestID, reason, triggeredBy string) (*models.DegradeAction, error) {
	var existing models.DegradeAction
	if err := db.GetDB().Where("request_id = ?", requestID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	var service models.Service
	if err := db.GetDB().First(&service, "id = ?", serviceID).Error; err != nil {
		return nil, errors.New("service not found")
	}

	previousStatus := service.DegradeStatus
	var newStatus models.DegradeStatus

	depHealth, _ := s.AggregateDependencyHealth(serviceID)

	switch previousStatus {
	case models.DegradeStatusNormal:
		if service.HealthStatus == models.HealthStatusDegraded || depHealth == models.HealthStatusDegraded {
			newStatus = models.DegradeStatusWarning
		} else if service.HealthStatus == models.HealthStatusUnhealthy || depHealth == models.HealthStatusUnhealthy {
			newStatus = models.DegradeStatusDegrading
		} else {
			return nil, errors.New("no degrade condition met")
		}
	case models.DegradeStatusWarning:
		if service.HealthStatus == models.HealthStatusUnhealthy || depHealth == models.HealthStatusUnhealthy {
			newStatus = models.DegradeStatusDegrading
		} else if service.HealthStatus == models.HealthStatusHealthy && depHealth == models.HealthStatusHealthy {
			newStatus = models.DegradeStatusNormal
		} else {
			return nil, errors.New("no state change")
		}
	case models.DegradeStatusDegrading:
		newStatus = models.DegradeStatusDegraded
	case models.DegradeStatusDegraded:
		if service.HealthStatus == models.HealthStatusHealthy && depHealth == models.HealthStatusHealthy {
			newStatus = models.DegradeStatusRecovering
		} else {
			return nil, errors.New("service still unhealthy")
		}
	case models.DegradeStatusRecovering:
		newStatus = models.DegradeStatusNormal
	default:
		newStatus = models.DegradeStatusNormal
	}

	action := &models.DegradeAction{
		ServiceID:      serviceID,
		RequestID:      requestID,
		ActionType:     "status_transition",
		Description:    string(previousStatus) + " -> " + string(newStatus),
		PreviousStatus: previousStatus,
		NewStatus:      newStatus,
		Reason:         reason,
		TriggeredBy:    triggeredBy,
		Timestamp:      time.Now(),
	}

	if err := db.GetDB().Create(action).Error; err != nil {
		return nil, err
	}

	service.DegradeStatus = newStatus
	service.UpdatedAt = time.Now()
	db.GetDB().Save(&service)

	return action, nil
}

func (s *HealthService) ConfirmRecovery(serviceID, requestID, degradeActionID, confirmedBy, confirmType, description string, isSuccess bool) (*models.RecoveryRecord, error) {
	var existing models.RecoveryRecord
	if err := db.GetDB().Where("request_id = ?", requestID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	var service models.Service
	if err := db.GetDB().First(&service, "id = ?", serviceID).Error; err != nil {
		return nil, errors.New("service not found")
	}

	if service.DegradeStatus != models.DegradeStatusRecovering {
		return nil, errors.New("service not in recovering state")
	}

	record := &models.RecoveryRecord{
		ServiceID:       serviceID,
		RequestID:       requestID,
		DegradeActionID: degradeActionID,
		ConfirmedBy:     confirmedBy,
		ConfirmType:     confirmType,
		Description:     description,
		IsSuccess:       isSuccess,
		Timestamp:       time.Now(),
	}

	if err := db.GetDB().Create(record).Error; err != nil {
		return nil, err
	}

	if isSuccess {
		service.DegradeStatus = models.DegradeStatusNormal
		service.HealthStatus = models.HealthStatusHealthy
	} else {
		service.DegradeStatus = models.DegradeStatusDegraded
	}
	service.UpdatedAt = time.Now()
	db.GetDB().Save(&service)

	return record, nil
}

func (s *HealthService) GetRegionHealthSummary(regionID string) (*models.HealthSummary, error) {
	var region models.Region
	if err := db.GetDB().First(&region, "id = ?", regionID).Error; err != nil {
		return nil, err
	}

	var services []models.Service
	if err := db.GetDB().Where("region_id = ?", regionID).Find(&services).Error; err != nil {
		return nil, err
	}

	summary := &models.HealthSummary{
		RegionID:   region.ID,
		RegionName: region.Name,
		LastUpdated: time.Now(),
	}

	summary.TotalServices = len(services)
	for _, svc := range services {
		switch svc.HealthStatus {
		case models.HealthStatusHealthy:
			summary.HealthyCount++
		case models.HealthStatusDegraded:
			summary.DegradedCount++
		case models.HealthStatusUnhealthy:
			summary.UnhealthyCount++
		default:
			summary.UnknownCount++
		}
	}

	switch {
	case summary.UnhealthyCount > 0:
		summary.OverallStatus = models.HealthStatusUnhealthy
	case summary.DegradedCount > 0:
		summary.OverallStatus = models.HealthStatusDegraded
	case summary.HealthyCount == summary.TotalServices:
		summary.OverallStatus = models.HealthStatusHealthy
	default:
		summary.OverallStatus = models.HealthStatusUnknown
	}

	return summary, nil
}

func (s *HealthService) GetProbeHistory(serviceID string, limit int) ([]models.ProbeResult, error) {
	var results []models.ProbeResult
	err := db.GetDB().Where("service_id = ?", serviceID).
		Order("timestamp desc").
		Limit(limit).
		Find(&results).Error
	return results, err
}

func (s *HealthService) GetDegradeHistory(serviceID string, limit int) ([]models.DegradeAction, error) {
	var actions []models.DegradeAction
	err := db.GetDB().Where("service_id = ?", serviceID).
		Order("timestamp desc").
		Limit(limit).
		Find(&actions).Error
	return actions, err
}
