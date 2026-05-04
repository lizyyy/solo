package services

import (
	"context"
	"os"
	"path/filepath"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
	"performance-tracker/pkg/utils"
)

type ImportService struct {
	repo *repository.Repository
}

func NewImportService(repo *repository.Repository) *ImportService {
	return &ImportService{repo: repo}
}

func (s *ImportService) ImportRoutesYAML(ctx context.Context, projectID uint, filePath string) (int, error) {
	// 验证项目是否存在
	_, err := s.repo.GetProjectByID(ctx, projectID)
	if err != nil {
		return 0, err
	}

	// 验证文件是否存在
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return 0, err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return 0, err
	}

	// 解析 YAML 文件
	routes, err := utils.ParseRoutesYAML(absPath)
	if err != nil {
		return 0, err
	}

	// 导入到数据库
	count := 0
	for _, route := range routes {
		route.ProjectID = projectID
		if err := s.repo.CreateRoute(ctx, &route); err != nil {
			return count, err
		}
		count++
	}

	return count, nil
}

func (s *ImportService) ImportSamplesJSONL(ctx context.Context, projectID uint, filePath string) (int, error) {
	// 验证项目是否存在
	_, err := s.repo.GetProjectByID(ctx, projectID)
	if err != nil {
		return 0, err
	}

	// 验证文件是否存在
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return 0, err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return 0, err
	}

	// 解析 JSONL 文件
	samples, err := utils.ParseSamplesJSONL(absPath)
	if err != nil {
		return 0, err
	}

	// 导入到数据库
	count := 0
	for _, sample := range samples {
		sample.ProjectID = projectID
		if err := s.repo.CreateSample(ctx, &sample); err != nil {
			return count, err
		}
		count++
	}

	return count, nil
}

func (s *ImportService) ImportBaselineJSON(ctx context.Context, projectID uint, filePath string) (*models.Baseline, error) {
	// 验证项目是否存在
	_, err := s.repo.GetProjectByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	// 验证文件是否存在
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return nil, err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return nil, err
	}

	// 解析 JSON 文件
	baseline, err := utils.ParseBaselineJSON(absPath)
	if err != nil {
		return nil, err
	}

	// 如果是 active 基线，先取消其他 active 基线
	if baseline.IsActive {
		existingBaselines, err := s.repo.GetBaselinesByProjectID(ctx, projectID)
		if err != nil {
			return nil, err
		}

		for _, b := range existingBaselines {
			if b.IsActive {
				b.IsActive = false
				if err := s.repo.UpdateBaseline(ctx, &b); err != nil {
					return nil, err
				}
			}
		}
	}

	// 导入到数据库
	baseline.ProjectID = projectID
	if err := s.repo.CreateBaseline(ctx, baseline); err != nil {
		return nil, err
	}

	return baseline, nil
}

func (s *ImportService) ImportProfileEventsJSON(ctx context.Context, projectID uint, filePath string, runID *uint) (int, error) {
	// 验证项目是否存在
	_, err := s.repo.GetProjectByID(ctx, projectID)
	if err != nil {
		return 0, err
	}

	// 如果提供了 runID，验证运行是否存在
	if runID != nil {
		_, err := s.repo.GetRunByID(ctx, *runID)
		if err != nil {
			return 0, err
		}
	}

	// 验证文件是否存在
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return 0, err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return 0, err
	}

	// 解析 JSON 文件
	events, err := utils.ParseProfileEventsJSON(absPath)
	if err != nil {
		return 0, err
	}

	// 导入到数据库
	count := 0
	for _, event := range events {
		event.ProjectID = projectID
		if runID != nil {
			event.RunID = *runID
		}
		if err := s.repo.CreateProfileEvent(ctx, &event); err != nil {
			return count, err
		}
		count++
	}

	return count, nil
}
