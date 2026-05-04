package services

import (
	"context"
	"fmt"
	"performance-tracker/internal/models"
	"performance-tracker/internal/repository"
)

type ComparisonService struct {
	repo *repository.Repository
}

func NewComparisonService(repo *repository.Repository) *ComparisonService {
	return &ComparisonService{repo: repo}
}

func (s *ComparisonService) CompareRunWithBaseline(ctx context.Context, runID uint, baselineID *uint) (*models.RunComparison, error) {
	// 获取运行数据
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("run not found: %w", err)
	}

	// 检查运行状态
	if run.Status != models.RunStatusCompleted {
		return nil, fmt.Errorf("run is not completed, status: %s", run.Status)
	}

	// 获取基线数据
	var baseline *models.Baseline
	if baselineID != nil {
		baseline, err = s.repo.GetBaselineByID(ctx, *baselineID)
		if err != nil {
			return nil, fmt.Errorf("baseline not found: %w", err)
		}
	} else {
		// 使用项目的 active 基线
		baseline, err = s.repo.GetActiveBaseline(ctx, run.ProjectID)
		if err != nil {
			return nil, fmt.Errorf("no active baseline found for project: %w", err)
		}
	}

	// 计算差异
	comparison := s.calculateComparison(run.Metrics, baseline.Metrics)

	// 创建运行对比记录
	runComparison := &models.RunComparison{
		RunID:           runID,
		BaselineID:      baseline.ID,
		MetricsComparison: comparison,
	}

	if err := s.repo.CreateRunComparison(ctx, runComparison); err != nil {
		return nil, fmt.Errorf("failed to create run comparison: %w", err)
	}

	return runComparison, nil
}

func (s *ComparisonService) calculateComparison(runMetrics models.RunMetrics, baselineMetrics models.BaselineMetrics) models.MetricsComparison {
	var comparison models.MetricsComparison

	// 计算 P50 差异
	if baselineMetrics.P50Ms > 0 {
		comparison.P50DiffMs = runMetrics.P50Ms - baselineMetrics.P50Ms
		comparison.P50DiffPercent = ((runMetrics.P50Ms - baselineMetrics.P50Ms) / baselineMetrics.P50Ms) * 100
	}

	// 计算 P95 差异
	if baselineMetrics.P95Ms > 0 {
		comparison.P95DiffMs = runMetrics.P95Ms - baselineMetrics.P95Ms
		comparison.P95DiffPercent = ((runMetrics.P95Ms - baselineMetrics.P95Ms) / baselineMetrics.P95Ms) * 100
	}

	// 计算 P99 差异
	if baselineMetrics.P99Ms > 0 {
		comparison.P99DiffMs = runMetrics.P99Ms - baselineMetrics.P99Ms
		comparison.P99DiffPercent = ((runMetrics.P99Ms - baselineMetrics.P99Ms) / baselineMetrics.P99Ms) * 100
	}

	// 计算吞吐率差异
	if baselineMetrics.Throughput > 0 {
		comparison.ThroughputDiff = runMetrics.Throughput - baselineMetrics.Throughput
		comparison.ThroughputDiffPercent = ((runMetrics.Throughput - baselineMetrics.Throughput) / baselineMetrics.Throughput) * 100
	}

	// 计算错误率差异
	comparison.ErrorRateDiff = runMetrics.ErrorRate - baselineMetrics.ErrorRate

	// 计算超时率差异
	comparison.TimeoutRateDiff = runMetrics.TimeoutRate - baselineMetrics.TimeoutRate

	// 检测性能回退
	comparison.HasRegression = s.detectRegression(comparison, runMetrics, baselineMetrics)

	return comparison
}

func (s *ComparisonService) detectRegression(comparison models.MetricsComparison, runMetrics models.RunMetrics, baselineMetrics models.BaselineMetrics) bool {
	// 定义回退阈值
	const (
		latencyRegressionThreshold = 20.0 // 延迟增加 20%
		throughputRegressionThreshold = -10.0 // 吞吐率下降 10%
		errorRateRegressionThreshold = 0.05 // 错误率增加 5%
		timeoutRateRegressionThreshold = 0.02 // 超时率增加 2%
	)

	// 检查 P95 延迟回退
	if comparison.P95DiffPercent > latencyRegressionThreshold {
		return true
	}

	// 检查 P99 延迟回退
	if comparison.P99DiffPercent > latencyRegressionThreshold {
		return true
	}

	// 检查吞吐率回退
	if comparison.ThroughputDiffPercent < throughputRegressionThreshold {
		return true
	}

	// 检查错误率回退
	if comparison.ErrorRateDiff > errorRateRegressionThreshold {
		return true
	}

	// 检查超时率回退
	if comparison.TimeoutRateDiff > timeoutRateRegressionThreshold {
		return true
	}

	return false
}

func (s *ComparisonService) GetRunComparisonByID(ctx context.Context, id uint) (*models.RunComparison, error) {
	return s.repo.GetRunComparisonByID(ctx, id)
}

func (s *ComparisonService) GetRunComparisonsByRunID(ctx context.Context, runID uint) ([]models.RunComparison, error) {
	return s.repo.GetRunComparisonsByRunID(ctx, runID)
}
