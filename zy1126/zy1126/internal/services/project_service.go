package services

import (
	"context"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
)

type ProjectService struct {
	repo *repository.Repository
}

func NewProjectService(repo *repository.Repository) *ProjectService {
	return &ProjectService{repo: repo}
}

func (s *ProjectService) CreateProject(ctx context.Context, project *models.Project) error {
	return s.repo.CreateProject(ctx, project)
}

func (s *ProjectService) GetProjectByID(ctx context.Context, id uint) (*models.Project, error) {
	return s.repo.GetProjectByID(ctx, id)
}

func (s *ProjectService) GetProjectByName(ctx context.Context, name string) (*models.Project, error) {
	return s.repo.GetProjectByName(ctx, name)
}

func (s *ProjectService) ListProjects(ctx context.Context) ([]models.Project, error) {
	return s.repo.ListProjects(ctx)
}

func (s *ProjectService) UpdateProject(ctx context.Context, project *models.Project) error {
	return s.repo.UpdateProject(ctx, project)
}

func (s *ProjectService) DeleteProject(ctx context.Context, id uint) error {
	return s.repo.DeleteProject(ctx, id)
}

func (s *ProjectService) GetProjectWithDetails(ctx context.Context, id uint) (*models.Project, error) {
	project, err := s.repo.GetProjectByID(ctx, id)
	if err != nil {
		return nil, err
	}

	routes, err := s.repo.GetRoutesByProjectID(ctx, id)
	if err != nil {
		return nil, err
	}
	project.Routes = routes

	runs, err := s.repo.GetRunsByProjectID(ctx, id)
	if err != nil {
		return nil, err
	}
	project.Runs = runs

	baselines, err := s.repo.GetBaselinesByProjectID(ctx, id)
	if err != nil {
		return nil, err
	}
	project.Baselines = baselines

	samples, err := s.repo.GetSamplesByProjectID(ctx, id)
	if err != nil {
		return nil, err
	}
	project.Samples = samples

	return project, nil
}
