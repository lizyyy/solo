package service

import (
	"secure-unpack-api/internal/model"
	"secure-unpack-api/internal/store"
	"testing"
)

func TestCreateTask(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task1, err := s.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}
	if task1.TaskID == "" {
		t.Error("Expected non-empty TaskID")
	}
	if task1.Status != model.StatusCreated {
		t.Errorf("Expected status %s, got %s", model.StatusCreated, task1.Status)
	}

	task2, err := s.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}
	if task1.TaskID != task2.TaskID {
		t.Error("Expected same TaskID for duplicate hash, got different")
	}
	if task1.CreatedAt != task2.CreatedAt {
		t.Error("Expected same CreatedAt for duplicate hash, got different")
	}
}

func TestCreateTaskValidation(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	tests := []struct {
		name    string
		req     *model.CreateTaskRequest
		wantErr bool
	}{
		{
			name: "missing archive_name",
			req: &model.CreateTaskRequest{
				ArchiveName: "",
				ArchiveType: model.ArchiveZip,
				ArchiveSize: 1024,
				FileHash:    "abc123",
			},
			wantErr: true,
		},
		{
			name: "invalid archive_type",
			req: &model.CreateTaskRequest{
				ArchiveName: "test.zip",
				ArchiveType: "invalid",
				ArchiveSize: 1024,
				FileHash:    "abc123",
			},
			wantErr: true,
		},
		{
			name: "zero archive_size",
			req: &model.CreateTaskRequest{
				ArchiveName: "test.zip",
				ArchiveType: model.ArchiveZip,
				ArchiveSize: 0,
				FileHash:    "abc123",
			},
			wantErr: true,
		},
		{
			name: "negative archive_size",
			req: &model.CreateTaskRequest{
				ArchiveName: "test.zip",
				ArchiveType: model.ArchiveZip,
				ArchiveSize: -1,
				FileHash:    "abc123",
			},
			wantErr: true,
		},
		{
			name: "missing file_hash",
			req: &model.CreateTaskRequest{
				ArchiveName: "test.zip",
				ArchiveType: model.ArchiveZip,
				ArchiveSize: 1024,
				FileHash:    "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := s.CreateTask(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateTask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateTask(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	risks, err := s.ValidateTask(task.TaskID)
	if err != nil {
		t.Fatalf("ValidateTask failed: %v", err)
	}
	if len(risks) != 0 {
		t.Errorf("Expected 0 risks, got %d", len(risks))
	}

	updatedTask, _ := s.store.GetTask(task.TaskID)
	if updatedTask.Status != model.StatusValidated {
		t.Errorf("Expected status %s, got %s", model.StatusValidated, updatedTask.Status)
	}

	_, err = s.ValidateTask(task.TaskID)
	if err == nil {
		t.Error("Expected error for validating already validated task")
	}
}

func TestProcessTask(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	_, err := s.ValidateTask(task.TaskID)
	if err != nil {
		t.Fatalf("ValidateTask failed: %v", err)
	}

	files := []model.FileEntry{
		{
			Path:     "dir/file.txt",
			FileName: "file.txt",
			FileSize: 1024,
			IsDir:    false,
		},
	}

	result, err := s.ProcessTask(task.TaskID, files)
	if err != nil {
		t.Fatalf("ProcessTask failed: %v", err)
	}
	if result.Status != model.StatusCompleted {
		t.Errorf("Expected status %s, got %s", model.StatusCompleted, result.Status)
	}
	if result.TotalFiles != 1 {
		t.Errorf("Expected 1 file, got %d", result.TotalFiles)
	}
	if result.RiskCount != 0 {
		t.Errorf("Expected 0 risks, got %d", result.RiskCount)
	}
}

func TestProcessTaskWithoutValidation(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	files := []model.FileEntry{
		{
			Path:     "dir/file.txt",
			FileName: "file.txt",
			FileSize: 1024,
			IsDir:    false,
		},
	}

	_, err := s.ProcessTask(task.TaskID, files)
	if err == nil {
		t.Error("Expected error for processing unvalidated task")
	}
}

func TestProcessTaskWithRisks(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	_, err := s.ValidateTask(task.TaskID)
	if err != nil {
		t.Fatalf("ValidateTask failed: %v", err)
	}

	files := []model.FileEntry{
		{
			Path:     "../etc/passwd",
			FileName: "passwd",
			FileSize: 1024,
			IsDir:    false,
		},
		{
			Path:     "malware.exe",
			FileName: "malware.exe",
			FileSize: 200 * 1024 * 1024,
			IsDir:    false,
		},
	}

	result, err := s.ProcessTask(task.TaskID, files)
	if err != nil {
		t.Fatalf("ProcessTask failed: %v", err)
	}
	if result.Status != model.StatusFailed {
		t.Errorf("Expected status %s, got %s", model.StatusFailed, result.Status)
	}
	if result.RiskCount != 2 {
		t.Errorf("Expected 2 risks, got %d", result.RiskCount)
	}

	foundPathTraversal := false
	foundBlockedExt := false
	for _, risk := range result.Risks {
		if risk.RiskType == "path_traversal" {
			foundPathTraversal = true
			if risk.RiskLevel != model.RiskCritical {
				t.Errorf("Expected critical level for path_traversal, got %s", risk.RiskLevel)
			}
		}
		if risk.RiskType == "blocked_extension" || risk.RiskType == "file_too_large" {
			foundBlockedExt = true
		}
	}
	if !foundPathTraversal {
		t.Error("Expected path_traversal risk")
	}
	if !foundBlockedExt {
		t.Error("Expected blocked_extension or file_too_large risk")
	}
}

func TestProcessTaskMaxFileCount(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	_, err := s.ValidateTask(task.TaskID)
	if err != nil {
		t.Fatalf("ValidateTask failed: %v", err)
	}

	files := make([]model.FileEntry, 10001)
	for i := 0; i < 10001; i++ {
		files[i] = model.FileEntry{
			Path:     "dir/file" + string(rune(i)) + ".txt",
			FileName: "file" + string(rune(i)) + ".txt",
			FileSize: 1024,
			IsDir:    false,
		}
	}

	result, err := s.ProcessTask(task.TaskID, files)
	if err != nil {
		t.Fatalf("ProcessTask failed: %v", err)
	}
	if result.Status != model.StatusFailed {
		t.Errorf("Expected status %s, got %s", model.StatusFailed, result.Status)
	}
	if result.RiskCount != 1 {
		t.Errorf("Expected 1 risk, got %d", result.RiskCount)
	}
	if result.Risks[0].RiskType != "too_many_files" {
		t.Errorf("Expected too_many_files risk, got %s", result.Risks[0].RiskType)
	}
}

func TestProcessTaskTotalSizeLimit(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	_, err := s.ValidateTask(task.TaskID)
	if err != nil {
		t.Fatalf("ValidateTask failed: %v", err)
	}

	files := []model.FileEntry{
		{
			Path:     "large/file1.txt",
			FileName: "file1.txt",
			FileSize: 600 * 1024 * 1024,
			IsDir:    false,
		},
		{
			Path:     "large/file2.txt",
			FileName: "file2.txt",
			FileSize: 600 * 1024 * 1024,
			IsDir:    false,
		},
	}

	result, err := s.ProcessTask(task.TaskID, files)
	if err != nil {
		t.Fatalf("ProcessTask failed: %v", err)
	}
	if result.Status != model.StatusFailed {
		t.Errorf("Expected status %s, got %s", model.StatusFailed, result.Status)
	}
	if result.RiskCount != 3 {
		t.Errorf("Expected 3 risks (2 file_too_large + 1 total_size_exceeded), got %d", result.RiskCount)
	}

	foundTotalSizeExceeded := false
	for _, risk := range result.Risks {
		if risk.RiskType == "total_size_exceeded" {
			foundTotalSizeExceeded = true
			break
		}
	}
	if !foundTotalSizeExceeded {
		t.Error("Expected total_size_exceeded risk")
	}
}

func TestGetTask(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	req := &model.CreateTaskRequest{
		ArchiveName: "test.zip",
		ArchiveType: model.ArchiveZip,
		ArchiveSize: 1024,
		FileHash:    "abc123",
	}

	task, _ := s.CreateTask(req)

	resp, err := s.GetTask(task.TaskID)
	if err != nil {
		t.Fatalf("GetTask failed: %v", err)
	}
	if resp.Task.TaskID != task.TaskID {
		t.Errorf("Expected TaskID %s, got %s", task.TaskID, resp.Task.TaskID)
	}

	_, err = s.GetTask("non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent task")
	}
}

func TestListTasks(t *testing.T) {
	s := NewUnpackService(store.NewMemoryStore())

	for i := 0; i < 5; i++ {
		req := &model.CreateTaskRequest{
			ArchiveName: "test.zip",
			ArchiveType: model.ArchiveZip,
			ArchiveSize: 1024,
			FileHash:    "hash" + string(rune(i)),
		}
		s.CreateTask(req)
	}

	tasks, err := s.ListTasks("", 10, 0)
	if err != nil {
		t.Fatalf("ListTasks failed: %v", err)
	}
	if len(tasks) != 5 {
		t.Errorf("Expected 5 tasks, got %d", len(tasks))
	}
}
