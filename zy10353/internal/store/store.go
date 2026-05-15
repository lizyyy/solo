package store

import (
	"secure-unpack-api/internal/model"
	"sync"
)

type Store interface {
	CreateTask(task *model.ArchiveTask) error
	GetTask(taskID string) (*model.ArchiveTask, error)
	GetTaskByHash(fileHash string) (*model.ArchiveTask, error)
	UpdateTask(task *model.ArchiveTask) error
	ListTasks(status model.TaskStatus, limit, offset int) ([]*model.ArchiveTask, error)
	SaveResult(result *model.ProcessResult) error
	GetResult(taskID string) (*model.ProcessResult, error)
	SaveRiskItem(risk *model.RiskItem) error
	GetRisks(taskID string) ([]*model.RiskItem, error)
	SaveRiskItems(risks []*model.RiskItem) error
}

type MemoryStore struct {
	tasks   map[string]*model.ArchiveTask
	hashMap map[string]*model.ArchiveTask
	results map[string]*model.ProcessResult
	risks   map[string][]*model.RiskItem
	mu      sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		tasks:   make(map[string]*model.ArchiveTask),
		hashMap: make(map[string]*model.ArchiveTask),
		results: make(map[string]*model.ProcessResult),
		risks:   make(map[string][]*model.RiskItem),
	}
}

func (s *MemoryStore) CreateTask(task *model.ArchiveTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if existing, ok := s.hashMap[task.FileHash]; ok {
		task.TaskID = existing.TaskID
		task.Status = existing.Status
		task.CreatedAt = existing.CreatedAt
		task.UpdatedAt = existing.UpdatedAt
		task.IsolationDir = existing.IsolationDir
		return nil
	}

	if _, ok := s.tasks[task.TaskID]; ok {
		return nil
	}

	s.tasks[task.TaskID] = task
	s.hashMap[task.FileHash] = task
	return nil
}

func (s *MemoryStore) GetTask(taskID string) (*model.ArchiveTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, ok := s.tasks[taskID]
	if !ok {
		return nil, nil
	}
	return task, nil
}

func (s *MemoryStore) GetTaskByHash(fileHash string) (*model.ArchiveTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, ok := s.hashMap[fileHash]
	if !ok {
		return nil, nil
	}
	return task, nil
}

func (s *MemoryStore) UpdateTask(task *model.ArchiveTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.tasks[task.TaskID] = task
	return nil
}

func (s *MemoryStore) ListTasks(status model.TaskStatus, limit, offset int) ([]*model.ArchiveTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var tasks []*model.ArchiveTask
	for _, task := range s.tasks {
		if status == "" || task.Status == status {
			tasks = append(tasks, task)
		}
	}

	if offset < 0 {
		offset = 0
	}

	if offset >= len(tasks) {
		return []*model.ArchiveTask{}, nil
	}

	end := offset + limit
	if end > len(tasks) {
		end = len(tasks)
	}

	return tasks[offset:end], nil
}

func (s *MemoryStore) SaveResult(result *model.ProcessResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.results[result.TaskID] = result
	return nil
}

func (s *MemoryStore) GetResult(taskID string) (*model.ProcessResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result, ok := s.results[taskID]
	if !ok {
		return nil, nil
	}
	return result, nil
}

func (s *MemoryStore) SaveRiskItem(risk *model.RiskItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.risks[risk.TaskID] = append(s.risks[risk.TaskID], risk)
	return nil
}

func (s *MemoryStore) SaveRiskItems(risks []*model.RiskItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, risk := range risks {
		s.risks[risk.TaskID] = append(s.risks[risk.TaskID], risk)
	}
	return nil
}

func (s *MemoryStore) GetRisks(taskID string) ([]*model.RiskItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	risks, ok := s.risks[taskID]
	if !ok {
		return []*model.RiskItem{}, nil
	}
	return risks, nil
}
