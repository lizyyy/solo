package repository

import (
	"certificate-renewal-api/internal/models"
	"sync"
)

type Store interface {
	CertificateRepository
	TaskRepository
	ReceiptRepository
	ReportRepository
}

type CertificateRepository interface {
	CreateCertificate(cert *models.Certificate) error
	GetCertificate(id string) (*models.Certificate, error)
	UpdateCertificate(cert *models.Certificate) error
	ListCertificates() []*models.Certificate
	ListCertificatesByStatus(status models.CertificateStatus) []*models.Certificate
	DeleteCertificate(id string) error
}

type TaskRepository interface {
	CreateTask(task *models.RenewalTask) error
	GetTask(id string) (*models.RenewalTask, error)
	UpdateTask(task *models.RenewalTask) error
	ListTasks() []*models.RenewalTask
	ListTasksByStatus(status models.TaskStatus) []*models.RenewalTask
	ListTasksByCertificate(certID string) []*models.RenewalTask
	FindPendingTasks() []*models.RenewalTask
	FindActiveTasks() []*models.RenewalTask
	CancelTask(id string) error
}

type ReceiptRepository interface {
	CreateReceipt(receipt *models.DeploymentReceipt) error
	GetReceipt(id string) (*models.DeploymentReceipt, error)
	UpdateReceipt(receipt *models.DeploymentReceipt) error
	ListReceiptsByTask(taskID string) []*models.DeploymentReceipt
}

type ReportRepository interface {
	SaveReport(report *models.ExpiryReport) error
	GetReport(id string) (*models.ExpiryReport, error)
	ListReports() []*models.ExpiryReport
}

type InMemoryStore struct {
	certificates map[string]*models.Certificate
	tasks        map[string]*models.RenewalTask
	receipts     map[string]*models.DeploymentReceipt
	reports      map[string]*models.ExpiryReport
	mu           sync.RWMutex
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		certificates: make(map[string]*models.Certificate),
		tasks:        make(map[string]*models.RenewalTask),
		receipts:     make(map[string]*models.DeploymentReceipt),
		reports:      make(map[string]*models.ExpiryReport),
	}
}

func (s *InMemoryStore) CreateCertificate(cert *models.Certificate) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.certificates[cert.ID] = cert
	return nil
}

func (s *InMemoryStore) GetCertificate(id string) (*models.Certificate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cert, exists := s.certificates[id]
	if !exists {
		return nil, models.ErrCertificateNotFound
	}
	return cert, nil
}

func (s *InMemoryStore) UpdateCertificate(cert *models.Certificate) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.certificates[cert.ID]; !exists {
		return models.ErrCertificateNotFound
	}
	s.certificates[cert.ID] = cert
	return nil
}

func (s *InMemoryStore) ListCertificates() []*models.Certificate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*models.Certificate, 0, len(s.certificates))
	for _, cert := range s.certificates {
		list = append(list, cert)
	}
	return list
}

func (s *InMemoryStore) ListCertificatesByStatus(status models.CertificateStatus) []*models.Certificate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*models.Certificate
	for _, cert := range s.certificates {
		if cert.Status == status {
			list = append(list, cert)
		}
	}
	return list
}

func (s *InMemoryStore) DeleteCertificate(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.certificates[id]; !exists {
		return models.ErrCertificateNotFound
	}
	delete(s.certificates, id)
	return nil
}

func (s *InMemoryStore) CreateTask(task *models.RenewalTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tasks[task.ID] = task
	return nil
}

func (s *InMemoryStore) GetTask(id string) (*models.RenewalTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	task, exists := s.tasks[id]
	if !exists {
		return nil, models.ErrTaskNotFound
	}
	return task, nil
}

func (s *InMemoryStore) UpdateTask(task *models.RenewalTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.tasks[task.ID]; !exists {
		return models.ErrTaskNotFound
	}
	s.tasks[task.ID] = task
	return nil
}

func (s *InMemoryStore) ListTasks() []*models.RenewalTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*models.RenewalTask, 0, len(s.tasks))
	for _, task := range s.tasks {
		list = append(list, task)
	}
	return list
}

func (s *InMemoryStore) ListTasksByStatus(status models.TaskStatus) []*models.RenewalTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*models.RenewalTask
	for _, task := range s.tasks {
		if task.Status == status {
			list = append(list, task)
		}
	}
	return list
}

func (s *InMemoryStore) ListTasksByCertificate(certID string) []*models.RenewalTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*models.RenewalTask
	for _, task := range s.tasks {
		if task.CertificateID == certID {
			list = append(list, task)
		}
	}
	return list
}

func (s *InMemoryStore) FindPendingTasks() []*models.RenewalTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*models.RenewalTask
	for _, task := range s.tasks {
		if task.IsPending() {
			list = append(list, task)
		}
	}
	return list
}

func (s *InMemoryStore) FindActiveTasks() []*models.RenewalTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*models.RenewalTask
	for _, task := range s.tasks {
		if task.IsProcessing() {
			list = append(list, task)
		}
	}
	return list
}

func (s *InMemoryStore) CancelTask(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, exists := s.tasks[id]
	if !exists {
		return models.ErrTaskNotFound
	}
	if task.IsProcessing() {
		return models.ErrInvalidStatus
	}
	task.Status = models.TaskStatusCancelled
	s.tasks[id] = task
	return nil
}

func (s *InMemoryStore) CreateReceipt(receipt *models.DeploymentReceipt) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.receipts[receipt.ID] = receipt
	return nil
}

func (s *InMemoryStore) GetReceipt(id string) (*models.DeploymentReceipt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	receipt, exists := s.receipts[id]
	if !exists {
		return nil, models.ErrTaskNotFound
	}
	return receipt, nil
}

func (s *InMemoryStore) UpdateReceipt(receipt *models.DeploymentReceipt) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.receipts[receipt.ID]; !exists {
		return models.ErrTaskNotFound
	}
	s.receipts[receipt.ID] = receipt
	return nil
}

func (s *InMemoryStore) ListReceiptsByTask(taskID string) []*models.DeploymentReceipt {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*models.DeploymentReceipt
	for _, receipt := range s.receipts {
		if receipt.TaskID == taskID {
			list = append(list, receipt)
		}
	}
	return list
}

func (s *InMemoryStore) SaveReport(report *models.ExpiryReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reports[report.ReportID] = report
	return nil
}

func (s *InMemoryStore) GetReport(id string) (*models.ExpiryReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	report, exists := s.reports[id]
	if !exists {
		return nil, models.ErrTaskNotFound
	}
	return report, nil
}

func (s *InMemoryStore) ListReports() []*models.ExpiryReport {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*models.ExpiryReport, 0, len(s.reports))
	for _, report := range s.reports {
		list = append(list, report)
	}
	return list
}
