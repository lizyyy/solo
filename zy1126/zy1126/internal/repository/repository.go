package repository

import (
	"context"
	"performance-tracker/internal/models"
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) AutoMigrate() error {
	return r.db.AutoMigrate(
		&models.Project{},
		&models.Route{},
		&models.Sample{},
		&models.Baseline{},
		&models.ProfileEvent{},
		&models.Run{},
		&models.RunComparison{},
		&models.SlowPathAttribution{},
		&models.Report{},
	)
}

// Project 相关操作
func (r *Repository) CreateProject(ctx context.Context, project *models.Project) error {
	return r.db.WithContext(ctx).Create(project).Error
}

func (r *Repository) GetProjectByID(ctx context.Context, id uint) (*models.Project, error) {
	var project models.Project
	if err := r.db.WithContext(ctx).First(&project, id).Error; err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *Repository) GetProjectByName(ctx context.Context, name string) (*models.Project, error) {
	var project models.Project
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&project).Error; err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *Repository) ListProjects(ctx context.Context) ([]models.Project, error) {
	var projects []models.Project
	if err := r.db.WithContext(ctx).Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (r *Repository) UpdateProject(ctx context.Context, project *models.Project) error {
	return r.db.WithContext(ctx).Save(project).Error
}

func (r *Repository) DeleteProject(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Project{}, id).Error
}

// Route 相关操作
func (r *Repository) CreateRoute(ctx context.Context, route *models.Route) error {
	return r.db.WithContext(ctx).Create(route).Error
}

func (r *Repository) GetRouteByID(ctx context.Context, id uint) (*models.Route, error) {
	var route models.Route
	if err := r.db.WithContext(ctx).First(&route, id).Error; err != nil {
		return nil, err
	}
	return &route, nil
}

func (r *Repository) GetRoutesByProjectID(ctx context.Context, projectID uint) ([]models.Route, error) {
	var routes []models.Route
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&routes).Error; err != nil {
		return nil, err
	}
	return routes, nil
}

func (r *Repository) UpdateRoute(ctx context.Context, route *models.Route) error {
	return r.db.WithContext(ctx).Save(route).Error
}

func (r *Repository) DeleteRoute(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Route{}, id).Error
}

// Sample 相关操作
func (r *Repository) CreateSample(ctx context.Context, sample *models.Sample) error {
	return r.db.WithContext(ctx).Create(sample).Error
}

func (r *Repository) GetSampleByID(ctx context.Context, id uint) (*models.Sample, error) {
	var sample models.Sample
	if err := r.db.WithContext(ctx).First(&sample, id).Error; err != nil {
		return nil, err
	}
	return &sample, nil
}

func (r *Repository) GetSamplesByProjectID(ctx context.Context, projectID uint) ([]models.Sample, error) {
	var samples []models.Sample
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&samples).Error; err != nil {
		return nil, err
	}
	return samples, nil
}

func (r *Repository) UpdateSample(ctx context.Context, sample *models.Sample) error {
	return r.db.WithContext(ctx).Save(sample).Error
}

func (r *Repository) DeleteSample(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Sample{}, id).Error
}

// Baseline 相关操作
func (r *Repository) CreateBaseline(ctx context.Context, baseline *models.Baseline) error {
	return r.db.WithContext(ctx).Create(baseline).Error
}

func (r *Repository) GetBaselineByID(ctx context.Context, id uint) (*models.Baseline, error) {
	var baseline models.Baseline
	if err := r.db.WithContext(ctx).First(&baseline, id).Error; err != nil {
		return nil, err
	}
	return &baseline, nil
}

func (r *Repository) GetBaselinesByProjectID(ctx context.Context, projectID uint) ([]models.Baseline, error) {
	var baselines []models.Baseline
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&baselines).Error; err != nil {
		return nil, err
	}
	return baselines, nil
}

func (r *Repository) GetActiveBaseline(ctx context.Context, projectID uint) (*models.Baseline, error) {
	var baseline models.Baseline
	if err := r.db.WithContext(ctx).Where("project_id = ? AND is_active = ?", projectID, true).First(&baseline).Error; err != nil {
		return nil, err
	}
	return &baseline, nil
}

func (r *Repository) UpdateBaseline(ctx context.Context, baseline *models.Baseline) error {
	return r.db.WithContext(ctx).Save(baseline).Error
}

func (r *Repository) DeleteBaseline(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Baseline{}, id).Error
}

// ProfileEvent 相关操作
func (r *Repository) CreateProfileEvent(ctx context.Context, event *models.ProfileEvent) error {
	return r.db.WithContext(ctx).Create(event).Error
}

func (r *Repository) GetProfileEventByID(ctx context.Context, id uint) (*models.ProfileEvent, error) {
	var event models.ProfileEvent
	if err := r.db.WithContext(ctx).First(&event, id).Error; err != nil {
		return nil, err
	}
	return &event, nil
}

func (r *Repository) GetProfileEventsByProjectID(ctx context.Context, projectID uint) ([]models.ProfileEvent, error) {
	var events []models.ProfileEvent
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&events).Error; err != nil {
		return nil, err
	}
	return events, nil
}

func (r *Repository) GetProfileEventsByRunID(ctx context.Context, runID uint) ([]models.ProfileEvent, error) {
	var events []models.ProfileEvent
	if err := r.db.WithContext(ctx).Where("run_id = ?", runID).Find(&events).Error; err != nil {
		return nil, err
	}
	return events, nil
}

func (r *Repository) UpdateProfileEvent(ctx context.Context, event *models.ProfileEvent) error {
	return r.db.WithContext(ctx).Save(event).Error
}

func (r *Repository) DeleteProfileEvent(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.ProfileEvent{}, id).Error
}

// Run 相关操作
func (r *Repository) CreateRun(ctx context.Context, run *models.Run) error {
	return r.db.WithContext(ctx).Create(run).Error
}

func (r *Repository) GetRunByID(ctx context.Context, id uint) (*models.Run, error) {
	var run models.Run
	if err := r.db.WithContext(ctx).First(&run, id).Error; err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *Repository) GetRunsByProjectID(ctx context.Context, projectID uint) ([]models.Run, error) {
	var runs []models.Run
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").Find(&runs).Error; err != nil {
		return nil, err
	}
	return runs, nil
}

func (r *Repository) UpdateRun(ctx context.Context, run *models.Run) error {
	return r.db.WithContext(ctx).Save(run).Error
}

func (r *Repository) DeleteRun(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Run{}, id).Error
}

// RunComparison 相关操作
func (r *Repository) CreateRunComparison(ctx context.Context, comparison *models.RunComparison) error {
	return r.db.WithContext(ctx).Create(comparison).Error
}

func (r *Repository) GetRunComparisonByID(ctx context.Context, id uint) (*models.RunComparison, error) {
	var comparison models.RunComparison
	if err := r.db.WithContext(ctx).First(&comparison, id).Error; err != nil {
		return nil, err
	}
	return &comparison, nil
}

func (r *Repository) GetRunComparisonsByRunID(ctx context.Context, runID uint) ([]models.RunComparison, error) {
	var comparisons []models.RunComparison
	if err := r.db.WithContext(ctx).Where("run_id = ?", runID).Find(&comparisons).Error; err != nil {
		return nil, err
	}
	return comparisons, nil
}

func (r *Repository) UpdateRunComparison(ctx context.Context, comparison *models.RunComparison) error {
	return r.db.WithContext(ctx).Save(comparison).Error
}

func (r *Repository) DeleteRunComparison(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.RunComparison{}, id).Error
}

// SlowPathAttribution 相关操作
func (r *Repository) CreateSlowPathAttribution(ctx context.Context, attribution *models.SlowPathAttribution) error {
	return r.db.WithContext(ctx).Create(attribution).Error
}

func (r *Repository) GetSlowPathAttributionByID(ctx context.Context, id uint) (*models.SlowPathAttribution, error) {
	var attribution models.SlowPathAttribution
	if err := r.db.WithContext(ctx).First(&attribution, id).Error; err != nil {
		return nil, err
	}
	return &attribution, nil
}

func (r *Repository) GetSlowPathAttributionsByRunID(ctx context.Context, runID uint) ([]models.SlowPathAttribution, error) {
	var attributions []models.SlowPathAttribution
	if err := r.db.WithContext(ctx).Where("run_id = ?", runID).Order("priority ASC").Find(&attributions).Error; err != nil {
		return nil, err
	}
	return attributions, nil
}

func (r *Repository) UpdateSlowPathAttribution(ctx context.Context, attribution *models.SlowPathAttribution) error {
	return r.db.WithContext(ctx).Save(attribution).Error
}

func (r *Repository) DeleteSlowPathAttribution(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.SlowPathAttribution{}, id).Error
}

// Report 相关操作
func (r *Repository) CreateReport(ctx context.Context, report *models.Report) error {
	return r.db.WithContext(ctx).Create(report).Error
}

func (r *Repository) GetReportByID(ctx context.Context, id uint) (*models.Report, error) {
	var report models.Report
	if err := r.db.WithContext(ctx).First(&report, id).Error; err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *Repository) GetReportsByRunID(ctx context.Context, runID uint) ([]models.Report, error) {
	var reports []models.Report
	if err := r.db.WithContext(ctx).Where("run_id = ?", runID).Find(&reports).Error; err != nil {
		return nil, err
	}
	return reports, nil
}

func (r *Repository) UpdateReport(ctx context.Context, report *models.Report) error {
	return r.db.WithContext(ctx).Save(report).Error
}

func (r *Repository) DeleteReport(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Report{}, id).Error
}

// 事务操作
func (r *Repository) BeginTransaction() *gorm.DB {
	return r.db.Begin()
}

func (r *Repository) WithTransaction(tx *gorm.DB) *Repository {
	return &Repository{db: tx}
}

// 通用查询操作
func (r *Repository) DB() *gorm.DB {
	return r.db
}
