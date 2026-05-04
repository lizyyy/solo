package services

import (
	"context"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
)

type RouteService struct {
	repo *repository.Repository
}

func NewRouteService(repo *repository.Repository) *RouteService {
	return &RouteService{repo: repo}
}

func (s *RouteService) CreateRoute(ctx context.Context, route *models.Route) error {
	return s.repo.CreateRoute(ctx, route)
}

func (s *RouteService) GetRouteByID(ctx context.Context, id uint) (*models.Route, error) {
	return s.repo.GetRouteByID(ctx, id)
}

func (s *RouteService) GetRoutesByProjectID(ctx context.Context, projectID uint) ([]models.Route, error) {
	return s.repo.GetRoutesByProjectID(ctx, projectID)
}

func (s *RouteService) UpdateRoute(ctx context.Context, route *models.Route) error {
	return s.repo.UpdateRoute(ctx, route)
}

func (s *RouteService) DeleteRoute(ctx context.Context, id uint) error {
	return s.repo.DeleteRoute(ctx, id)
}

func (s *RouteService) UpdatePerformanceBudget(ctx context.Context, routeID uint, budget models.PerformanceBudget) error {
	route, err := s.repo.GetRouteByID(ctx, routeID)
	if err != nil {
		return err
	}

	route.PerformanceBudget = budget
	return s.repo.UpdateRoute(ctx, route)
}

func (s *RouteService) CheckBudgetViolation(ctx context.Context, routeID uint, metrics models.RunMetrics) (bool, string) {
	route, err := s.repo.GetRouteByID(ctx, routeID)
	if err != nil {
		return false, "Route not found"
	}

	budget := route.PerformanceBudget
	violations := []string{}

	if budget.P95MaxMs > 0 && metrics.P95Ms > budget.P95MaxMs {
		violations = append(violations, "P95 latency exceeded")
	}

	if budget.P99MaxMs > 0 && metrics.P99Ms > budget.P99MaxMs {
		violations = append(violations, "P99 latency exceeded")
	}

	if budget.ErrorRateMax > 0 && metrics.ErrorRate > budget.ErrorRateMax {
		violations = append(violations, "Error rate exceeded")
	}

	if budget.TimeoutRateMax > 0 && metrics.TimeoutRate > budget.TimeoutRateMax {
		violations = append(violations, "Timeout rate exceeded")
	}

	if budget.ThroughputMin > 0 && metrics.Throughput < budget.ThroughputMin {
		violations = append(violations, "Throughput below minimum")
	}

	if len(violations) > 0 {
		return true, "Budget violations: " + joinStrings(violations, ", ")
	}

	return false, ""
}

func joinStrings(slice []string, separator string) string {
	if len(slice) == 0 {
		return ""
	}

	result := slice[0]
	for i := 1; i < len(slice); i++ {
		result += separator + slice[i]
	}
	return result
}
