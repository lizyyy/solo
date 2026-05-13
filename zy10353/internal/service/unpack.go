package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"secure-unpack-api/internal/errors"
	"secure-unpack-api/internal/model"
	"secure-unpack-api/internal/store"
	"strings"
	"time"

	"github.com/google/uuid"
)

type UnpackService struct {
	store store.Store
	rules model.UnpackRule
}

func NewUnpackService(store store.Store) *UnpackService {
	return &UnpackService{
		store: store,
		rules: model.UnpackRule{
			MaxFileSize:       100 * 1024 * 1024,
			MaxTotalSize:      1 * 1024 * 1024 * 1024,
			MaxFileCount:      10000,
			AllowPathTraversal: false,
			BlockedExtensions: []string{".exe", ".bat", ".cmd", ".ps1", ".sh", ".vbs", ".js"},
			BlockedPatterns:   []string{"../", "..\\", "/etc/", "/root/", "C:\\Windows\\"},
		},
	}
}

func (s *UnpackService) CreateTask(req *model.CreateTaskRequest) (*model.ArchiveTask, error) {
	existingTask, err := s.store.GetTaskByHash(req.FileHash)
	if err != nil {
		return nil, err
	}
	if existingTask != nil {
		return existingTask, nil
	}

	taskID := uuid.New().String()
	now := time.Now()

	task := &model.ArchiveTask{
		TaskID:      taskID,
		ArchiveName: req.ArchiveName,
		ArchiveType: req.ArchiveType,
		ArchiveSize: req.ArchiveSize,
		FileHash:    req.FileHash,
		Status:      model.StatusCreated,
		CreatedAt:   now,
		UpdatedAt:   now,
		IsolationDir: filepath.Join(os.TempDir(), "secure-unpack", taskID),
	}

	err = s.store.CreateTask(task)
	if err != nil {
		return nil, err
	}

	return task, nil
}

func (s *UnpackService) GetTask(taskID string) (*model.TaskResponse, error) {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.ErrTaskNotFound
	}

	result, err := s.store.GetResult(taskID)
	if err != nil {
		return nil, err
	}

	risks, err := s.store.GetRisks(taskID)
	if err != nil {
		return nil, err
	}

	var riskItems []model.RiskItem
	for _, r := range risks {
		riskItems = append(riskItems, *r)
	}

	return &model.TaskResponse{
		Task:   *task,
		Result: result,
		Risks:  riskItems,
	}, nil
}

func (s *UnpackService) ValidateTask(taskID string) ([]*model.RiskItem, error) {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.ErrTaskNotFound
	}

	if task.Status != model.StatusCreated {
		return nil, errors.ErrInvalidStatus
	}

	var risks []*model.RiskItem

	if task.ArchiveSize > s.rules.MaxTotalSize {
		risks = append(risks, s.createRisk(taskID, "", "archive_too_large", model.RiskHigh,
			fmt.Sprintf("Archive size %d exceeds max total size %d", task.ArchiveSize, s.rules.MaxTotalSize)))
	}

	task.Status = model.StatusValidated
	task.UpdatedAt = time.Now()
	err = s.store.UpdateTask(task)
	if err != nil {
		return nil, err
	}

	if len(risks) > 0 {
		err = s.store.SaveRiskItems(risks)
		if err != nil {
			return nil, err
		}
	}

	return risks, nil
}

func (s *UnpackService) ProcessTask(taskID string, simulateFiles []model.FileEntry) (*model.ProcessResult, error) {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.ErrTaskNotFound
	}

	if task.Status != model.StatusValidated && task.Status != model.StatusCreated {
		return nil, errors.ErrInvalidStatus
	}

	task.Status = model.StatusProcessing
	task.UpdatedAt = time.Now()
	err = s.store.UpdateTask(task)
	if err != nil {
		return nil, err
	}

	result := &model.ProcessResult{
		TaskID:      taskID,
		Status:      model.StatusProcessing,
		StartedAt:   time.Now(),
		OutputDir:   task.IsolationDir,
	}

	var risks []*model.RiskItem
	var totalSize int64

	for _, file := range simulateFiles {
		risk, err := s.validateFile(taskID, file)
		if err != nil {
			risks = append(risks, risk)
			continue
		}
		if risk != nil {
			risks = append(risks, risk)
		}

		totalSize += file.FileSize
		result.TotalFiles++
		result.FileList = append(result.FileList, file)
	}

	result.TotalSize = totalSize
	result.RiskCount = len(risks)
	result.CompletedAt = time.Now()

	if len(risks) > 0 {
		result.Status = model.StatusCompleted
		for _, r := range risks {
			if r.RiskLevel == model.RiskCritical || r.RiskLevel == model.RiskHigh {
				result.Status = model.StatusFailed
				break
			}
		}
	} else {
		result.Status = model.StatusCompleted
	}

	task.Status = result.Status
	task.UpdatedAt = time.Now()
	err = s.store.UpdateTask(task)
	if err != nil {
		return nil, err
	}

	err = s.store.SaveResult(result)
	if err != nil {
		return nil, err
	}

	if len(risks) > 0 {
		err = s.store.SaveRiskItems(risks)
		if err != nil {
			return nil, err
		}
	}

	var riskItems []model.RiskItem
	for _, r := range risks {
		riskItems = append(riskItems, *r)
	}
	result.Risks = riskItems

	return result, nil
}

func (s *UnpackService) validateFile(taskID string, file model.FileEntry) (*model.RiskItem, error) {
	if !s.rules.AllowPathTraversal {
		if strings.Contains(file.Path, "..") {
			return s.createRisk(taskID, file.Path, "path_traversal", model.RiskCritical,
				fmt.Sprintf("Path traversal detected in file path: %s", file.Path)), errors.ErrPathTraversal
		}
	}

	if file.FileSize > s.rules.MaxFileSize {
		return s.createRisk(taskID, file.Path, "file_too_large", model.RiskHigh,
			fmt.Sprintf("File %s size %d exceeds max file size %d", file.Path, file.FileSize, s.rules.MaxFileSize)), errors.ErrFileTooLarge
	}

	ext := strings.ToLower(filepath.Ext(file.FileName))
	for _, blocked := range s.rules.BlockedExtensions {
		if ext == blocked {
			return s.createRisk(taskID, file.Path, "blocked_extension", model.RiskHigh,
				fmt.Sprintf("File %s has blocked extension %s", file.Path, ext)), errors.ErrBlockedExtension
		}
	}

	for _, pattern := range s.rules.BlockedPatterns {
		if strings.Contains(file.Path, pattern) {
			return s.createRisk(taskID, file.Path, "blocked_pattern", model.RiskCritical,
				fmt.Sprintf("File %s contains blocked pattern %s", file.Path, pattern)), errors.ErrBlockedPattern
		}
	}

	return nil, nil
}

func (s *UnpackService) createRisk(taskID, filePath, riskType string, level model.RiskLevel, message string) *model.RiskItem {
	hash := sha256.Sum256([]byte(taskID + filePath + riskType + time.Now().String()))
	return &model.RiskItem{
		RiskID:     hex.EncodeToString(hash[:])[:16],
		TaskID:     taskID,
		FilePath:   filePath,
		RiskType:   riskType,
		RiskLevel:  level,
		Message:    message,
		DetectedAt: time.Now(),
	}
}

func (s *UnpackService) ListTasks(status model.TaskStatus, limit, offset int) ([]*model.ArchiveTask, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return s.store.ListTasks(status, limit, offset)
}

func (s *UnpackService) GetResult(taskID string) (*model.ProcessResult, error) {
	result, err := s.store.GetResult(taskID)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.ErrTaskNotFound
	}
	return result, nil
}

func (s *UnpackService) GetRisks(taskID string) ([]*model.RiskItem, error) {
	task, err := s.store.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.ErrTaskNotFound
	}
	return s.store.GetRisks(taskID)
}
