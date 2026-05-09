package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/mq"
	"grayscale-simulator/pkg/tracer"
)

type GrayReleaseService struct {
	defaultPercentage int
}

func NewGrayReleaseService(defaultPercentage int) *GrayReleaseService {
	return &GrayReleaseService{
		defaultPercentage: defaultPercentage,
	}
}

func (s *GrayReleaseService) CreateRelease(ctx context.Context, serviceName, version, description, strategy string, strategyConfig map[string]interface{}, createdBy string) (*model.GrayRelease, error) {
	ctx, span := tracer.StartSpan(ctx, "gray_release.CreateRelease")
	defer span.End()

	if strategy == "" {
		strategy = "percentage"
	}

	if strategyConfig == nil {
		strategyConfig = map[string]interface{}{
			"percentage": s.defaultPercentage,
		}
	}

	configJSON, err := json.Marshal(strategyConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal strategy config: %w", err)
	}

	release := &model.GrayRelease{
		ServiceName:    serviceName,
		Version:        version,
		Description:    description,
		Strategy:       strategy,
		StrategyConfig: configJSON,
		Status:         "draft",
		CreatedBy:      createdBy,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	query := `
		INSERT INTO gray_releases (service_name, version, description, strategy, strategy_config, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`

	var id int64
	err = database.QueryRow(query,
		release.ServiceName, release.Version, release.Description, release.Strategy, release.StrategyConfig,
		release.Status, release.CreatedBy, release.CreatedAt, release.UpdatedAt,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create gray release: %w", err)
	}

	release.ID = id
	logger.WithFields(map[string]interface{}{
		"release_id":   id,
		"service_name": serviceName,
		"version":      version,
	}).Info("Gray release created successfully")

	return release, nil
}

func (s *GrayReleaseService) StartRelease(ctx context.Context, releaseID int64) error {
	ctx, span := tracer.StartSpan(ctx, "gray_release.StartRelease")
	defer span.End()

	release, err := s.GetReleaseByID(ctx, releaseID)
	if err != nil {
		return fmt.Errorf("failed to get release: %w", err)
	}

	if release.Status != "draft" && release.Status != "paused" {
		return fmt.Errorf("release is not in draft or paused status")
	}

	now := time.Now()
	query := `
		UPDATE gray_releases 
		SET status = 'running', started_at = $1, updated_at = $2 
		WHERE id = $3
	`

	_, err = database.Exec(query, now, now, releaseID)
	if err != nil {
		return fmt.Errorf("failed to start release: %w", err)
	}

	event := &model.GrayEvent{
		EventType:   "release_started",
		ReleaseID:   releaseID,
		ServiceName: release.ServiceName,
		Version:     release.Version,
		Timestamp:   time.Now(),
		Payload:     json.RawMessage(`{}`),
	}

	if err := mq.PublishEvent(ctx, event); err != nil {
		logger.Errorf("Failed to publish release_started event: %v", err)
	}

	logger.WithField("release_id", releaseID).Info("Gray release started")
	return nil
}

func (s *GrayReleaseService) PauseRelease(ctx context.Context, releaseID int64) error {
	ctx, span := tracer.StartSpan(ctx, "gray_release.PauseRelease")
	defer span.End()

	query := `
		UPDATE gray_releases 
		SET status = 'paused', updated_at = $1 
		WHERE id = $2 AND status = 'running'
	`

	result, err := database.Exec(query, time.Now(), releaseID)
	if err != nil {
		return fmt.Errorf("failed to pause release: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no running release found with id %d", releaseID)
	}

	logger.WithField("release_id", releaseID).Info("Gray release paused")
	return nil
}

func (s *GrayReleaseService) CompleteRelease(ctx context.Context, releaseID int64) error {
	ctx, span := tracer.StartSpan(ctx, "gray_release.CompleteRelease")
	defer span.End()

	now := time.Now()
	query := `
		UPDATE gray_releases 
		SET status = 'completed', completed_at = $1, updated_at = $2 
		WHERE id = $3 AND status = 'running'
	`

	result, err := database.Exec(query, now, now, releaseID)
	if err != nil {
		return fmt.Errorf("failed to complete release: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no running release found with id %d", releaseID)
	}

	logger.WithField("release_id", releaseID).Info("Gray release completed")
	return nil
}

func (s *GrayReleaseService) GetReleaseByID(ctx context.Context, releaseID int64) (*model.GrayRelease, error) {
	ctx, span := tracer.StartSpan(ctx, "gray_release.GetReleaseByID")
	defer span.End()

	var release model.GrayRelease
	query := `SELECT * FROM gray_releases WHERE id = $1`

	if err := database.Get(&release, query, releaseID); err != nil {
		return nil, fmt.Errorf("failed to get release: %w", err)
	}

	return &release, nil
}

func (s *GrayReleaseService) ListReleases(ctx context.Context, serviceName string, status string, limit, offset int) ([]*model.GrayRelease, error) {
	ctx, span := tracer.StartSpan(ctx, "gray_release.ListReleases")
	defer span.End()

	query := `SELECT * FROM gray_releases WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if serviceName != "" {
		query += ` AND service_name = $` + strconv.Itoa(argIndex)
		args = append(args, serviceName)
		argIndex++
	}

	if status != "" {
		query += ` AND status = $` + strconv.Itoa(argIndex)
		args = append(args, status)
		argIndex++
	}

	query += ` ORDER BY created_at DESC`

	if limit > 0 {
		query += ` LIMIT $` + strconv.Itoa(argIndex)
		args = append(args, limit)
		argIndex++
	}

	if offset > 0 {
		query += ` OFFSET $` + strconv.Itoa(argIndex)
		args = append(args, offset)
	}

	var releases []*model.GrayRelease
	if err := database.Select(&releases, query, args...); err != nil {
		return nil, fmt.Errorf("failed to list releases: %w", err)
	}

	return releases, nil
}

func (s *GrayReleaseService) AddInstance(ctx context.Context, releaseID int64, instanceID, host string, port int, version string) error {
	ctx, span := tracer.StartSpan(ctx, "gray_release.AddInstance")
	defer span.End()

	query := `
		INSERT INTO gray_instances (release_id, instance_id, host, port, version, status, traffic_weight, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', 0, $6)
	`

	_, err := database.Exec(query, releaseID, instanceID, host, port, version, time.Now())
	if err != nil {
		return fmt.Errorf("failed to add instance: %w", err)
	}

	logger.WithFields(map[string]interface{}{
		"release_id":  releaseID,
		"instance_id": instanceID,
	}).Info("Instance added to gray release")

	return nil
}

func (s *GrayReleaseService) AssignTrafficToInstance(ctx context.Context, releaseID int64, instanceID string, trafficWeight int) error {
	ctx, span := tracer.StartSpan(ctx, "gray_release.AssignTrafficToInstance")
	defer span.End()

	now := time.Now()
	query := `
		UPDATE gray_instances 
		SET traffic_weight = $1, status = 'running', assigned_at = $2, updated_at = $3 
		WHERE release_id = $4 AND instance_id = $5
	`

	_, err := database.Exec(query, trafficWeight, now, now, releaseID, instanceID)
	if err != nil {
		return fmt.Errorf("failed to assign traffic: %w", err)
	}

	logger.WithFields(map[string]interface{}{
		"release_id":     releaseID,
		"instance_id":    instanceID,
		"traffic_weight": trafficWeight,
	}).Info("Traffic assigned to instance")

	return nil
}

func (s *GrayReleaseService) ShouldRouteToGray(ctx context.Context, release *model.GrayRelease, userID string, requestHeaders map[string]string) bool {
	ctx, span := tracer.StartSpan(ctx, "gray_release.ShouldRouteToGray")
	defer span.End()

	if release == nil || release.Status != "running" {
		return false
	}

	var config map[string]interface{}
	if err := json.Unmarshal(release.StrategyConfig, &config); err != nil {
		logger.Errorf("Failed to unmarshal strategy config: %v", err)
		return false
	}

	switch release.Strategy {
	case "percentage":
		percentage := s.defaultPercentage
		if p, ok := config["percentage"].(float64); ok {
			percentage = int(p)
		}
		return s.checkPercentage(userID, percentage)

	case "user_id":
		targetUsers, _ := config["target_users"].([]interface{})
		for _, u := range targetUsers {
			if uStr, ok := u.(string); ok && uStr == userID {
				return true
			}
		}
		return false

	case "header":
		headerName, _ := config["header_name"].(string)
		headerValue, _ := config["header_value"].(string)
		if headerName == "" {
			return false
		}
		return requestHeaders[headerName] == headerValue

	default:
		return false
	}
}

func (s *GrayReleaseService) checkPercentage(userID string, percentage int) bool {
	if percentage <= 0 {
		return false
	}
	if percentage >= 100 {
		return true
	}

	if userID == "" {
		userID = uuid.New().String()
	}

	var hash uint64
	for i := 0; i < len(userID); i++ {
		hash = hash*31 + uint64(userID[i])
	}

	return (hash % 100) < uint64(percentage)
}

