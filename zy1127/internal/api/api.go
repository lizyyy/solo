package api

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"concurrency-detector/internal/analyzer"
	"concurrency-detector/internal/exporter"
	"concurrency-detector/internal/models"
	"concurrency-detector/internal/replay"
	"concurrency-detector/internal/store"

	"github.com/google/uuid"
)

type Server struct {
	store     *store.Store
	analyzer  *analyzer.Analyzer
	replayer  *replay.Replayer
	activeReplays sync.Map
}

func NewServer(s *store.Store) *Server {
	return &Server{
		store:     s,
		analyzer:  analyzer.NewAnalyzer(),
		replayer:  replay.NewReplayer(),
	}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /projects", s.handleListProjects)
	mux.HandleFunc("POST /projects", s.handleCreateProject)
	mux.HandleFunc("GET /projects/{id}", s.handleGetProject)
	mux.HandleFunc("POST /projects/{id}/ingest", s.handleIngest)
	mux.HandleFunc("POST /projects/{id}/analyze", s.handleAnalyze)
	mux.HandleFunc("GET /projects/{id}/analysis", s.handleGetAnalysis)
	mux.HandleFunc("POST /projects/{id}/replay", s.handleCreateReplay)
	mux.HandleFunc("GET /projects/{id}/replay/{taskId}", s.handleGetReplay)
	mux.HandleFunc("GET /projects/{id}/workers", s.handleGetWorkers)
	mux.HandleFunc("GET /projects/{id}/export/{format}", s.handleExport)
	mux.HandleFunc("GET /projects/{id}/stats", s.handleGetStats)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "concurrency-detector",
		"time":    time.Now().Format(time.RFC3339),
	})
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := s.store.ListProjects()
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to list projects", err)
		return
	}
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"projects": projects,
		"total":    len(projects),
	})
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := s.decodeJSON(r, &req); err != nil {
		s.errorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.Name == "" {
		s.errorResponse(w, http.StatusBadRequest, "Project name is required", nil)
		return
	}

	now := time.Now()
	project := &models.Project{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.store.CreateProject(project); err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to create project", err)
		return
	}

	s.jsonResponse(w, http.StatusCreated, project)
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	project, err := s.store.GetProject(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get project", err)
		return
	}

	if project == nil {
		s.errorResponse(w, http.StatusNotFound, "Project not found", nil)
		return
	}

	s.jsonResponse(w, http.StatusOK, project)
}

func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	project, err := s.store.GetProject(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get project", err)
		return
	}
	if project == nil {
		s.errorResponse(w, http.StatusNotFound, "Project not found", nil)
		return
	}

	contentType := r.Header.Get("Content-Type")

	var mapCount, goroutineCount, workerCount int

	if strings.Contains(contentType, "application/jsonl") ||
		strings.HasSuffix(r.URL.RawQuery, "type=map-events") ||
		strings.Contains(r.Header.Get("X-Data-Type"), "map-events") {
		count, err := s.ingestMapEvents(projectID, r.Body)
		if err != nil {
			s.errorResponse(w, http.StatusBadRequest, "Failed to ingest map events", err)
			return
		}
		mapCount = count
	} else if strings.Contains(r.Header.Get("X-Data-Type"), "goroutines") ||
		strings.HasSuffix(r.URL.RawQuery, "type=goroutines") {
		count, err := s.ingestGoroutines(projectID, r.Body)
		if err != nil {
			s.errorResponse(w, http.StatusBadRequest, "Failed to ingest goroutine data", err)
			return
		}
		goroutineCount = count
	} else if strings.Contains(r.Header.Get("X-Data-Type"), "workers") ||
		strings.HasSuffix(r.URL.RawQuery, "type=workers") {
		count, err := s.ingestWorkers(projectID, r.Body)
		if err != nil {
			s.errorResponse(w, http.StatusBadRequest, "Failed to ingest worker data", err)
			return
		}
		workerCount = count
	} else {
		s.errorResponse(w, http.StatusBadRequest, "Unknown data type. Use X-Data-Type header or ?type= parameter", nil)
		return
	}

	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"project_id":        projectID,
		"map_events_loaded": mapCount,
		"goroutines_loaded": goroutineCount,
		"workers_loaded":    workerCount,
		"total_loaded":      mapCount + goroutineCount + workerCount,
	})
}

func (s *Server) ingestMapEvents(projectID string, body io.Reader) (int, error) {
	scanner := bufio.NewScanner(body)
	count := 0

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var event models.MapEvent
		if err := json.Unmarshal(line, &event); err != nil {
			return count, fmt.Errorf("line %d: %w", count+1, err)
		}

		event.ID = uuid.New().String()
		event.ProjectID = projectID

		if event.Timestamp.IsZero() {
			event.Timestamp = time.Now()
		}

		if err := s.store.CreateMapEvent(&event); err != nil {
			return count, err
		}
		count++
	}

	return count, scanner.Err()
}

func (s *Server) ingestGoroutines(projectID string, body io.Reader) (int, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return 0, err
	}

	var snapshots []*models.GoroutineSnapshot
	if err := json.Unmarshal(data, &snapshots); err == nil {
		snapshotID := uuid.New().String()
		count := 0
		for _, snap := range snapshots {
			snap.ID = uuid.New().String()
			snap.ProjectID = projectID
			if snap.SnapshotID == "" {
				snap.SnapshotID = snapshotID
			}
			if snap.Timestamp.IsZero() {
				snap.Timestamp = time.Now()
			}
			if err := s.store.CreateGoroutineSnapshot(snap); err != nil {
				return count, err
			}
			count++
		}
		return count, nil
	}

	snapshotID := uuid.New().String()
	lines := strings.Split(string(data), "\n")
	count := 0

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "goroutine ") {
			var gid int64
			var state string
			fmt.Sscanf(line, "goroutine %d [%s]:", &gid, &state)
			state = strings.TrimRight(state, "]:")

			snap := &models.GoroutineSnapshot{
				ID:          uuid.New().String(),
				ProjectID:   projectID,
				SnapshotID:  snapshotID,
				GoroutineID: gid,
				State:       state,
				Stack:       line,
				Timestamp:   time.Now(),
			}

			if err := s.store.CreateGoroutineSnapshot(snap); err != nil {
				return count, err
			}
			count++
		}
	}

	return count, nil
}

func (s *Server) ingestWorkers(projectID string, body io.Reader) (int, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return 0, err
	}

	var workers []*models.WorkerQueue
	if err := json.Unmarshal(data, &workers); err != nil {
		var single models.WorkerQueue
		if err := json.Unmarshal(data, &single); err != nil {
			return 0, fmt.Errorf("invalid JSON: %w", err)
		}
		workers = []*models.WorkerQueue{&single}
	}

	count := 0
	for _, w := range workers {
		w.ID = uuid.New().String()
		w.ProjectID = projectID
		if w.Timestamp.IsZero() {
			w.Timestamp = time.Now()
		}
		if err := s.store.CreateWorkerQueue(w); err != nil {
			return count, err
		}
		count++
	}

	return count, nil
}

func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	project, err := s.store.GetProject(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get project", err)
		return
	}
	if project == nil {
		s.errorResponse(w, http.StatusNotFound, "Project not found", nil)
		return
	}

	mapEvents, err := s.store.GetMapEvents(projectID, 0)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get map events", err)
		return
	}

	goroutines, err := s.store.GetGoroutineSnapshots(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get goroutine snapshots", err)
		return
	}

	workers, err := s.store.GetWorkerQueues(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get worker queues", err)
		return
	}

	ctx := &analyzer.AnalysisContext{
		MapEvents:          mapEvents,
		GoroutineSnapshots: goroutines,
		WorkerQueues:       workers,
	}

	results, err := s.analyzer.Analyze(ctx)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Analysis failed", err)
		return
	}

	if err := s.store.DeleteAnalysisResults(projectID); err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to clear old results", err)
		return
	}

	for _, r := range results {
		r.ProjectID = projectID
		if err := s.store.CreateAnalysisResult(r); err != nil {
			s.errorResponse(w, http.StatusInternalServerError, "Failed to save result", err)
			return
		}
	}

	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"project_id":       projectID,
		"analysis_results": results,
		"total_findings":   len(results),
	})
}

func (s *Server) handleGetAnalysis(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	results, err := s.store.GetAnalysisResults(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get analysis results", err)
		return
	}

	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"project_id":       projectID,
		"analysis_results": results,
		"total_findings":   len(results),
	})
}

func (s *Server) handleCreateReplay(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	project, err := s.store.GetProject(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get project", err)
		return
	}
	if project == nil {
		s.errorResponse(w, http.StatusNotFound, "Project not found", nil)
		return
	}

	var req struct {
		Category      string                 `json:"category"`
		Concurrency   int                    `json:"concurrency"`
		Duration      int                    `json:"duration_seconds"`
		Timeout       int                    `json:"timeout_seconds"`
		Config        map[string]interface{} `json:"config"`
		AnalysisResultID string              `json:"analysis_result_id"`
	}

	if err := s.decodeJSON(r, &req); err != nil {
		s.errorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.Category == "" {
		s.errorResponse(w, http.StatusBadRequest, "Category is required", nil)
		return
	}

	category := models.RiskCategory(req.Category)

	if req.Concurrency <= 0 {
		req.Concurrency = 10
	}
	if req.Duration <= 0 {
		req.Duration = 5
	}
	if req.Timeout <= 0 {
		req.Timeout = 30
	}

	now := time.Now()
	task := &models.ReplayTask{
		ID:               uuid.New().String(),
		ProjectID:        projectID,
		AnalysisResultID: req.AnalysisResultID,
		TargetCategory:   category,
		Status:           models.ReplayStatusPending,
		Concurrency:      req.Concurrency,
		Duration:         time.Duration(req.Duration),
		Timeout:          time.Duration(req.Timeout),
		CreatedAt:        now,
	}

	if req.Config != nil {
		_ = task.SetConfig(req.Config)
	}

	if err := s.store.CreateReplayTask(task); err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to create replay task", err)
		return
	}

	go s.runReplayTask(task)

	s.jsonResponse(w, http.StatusAccepted, map[string]interface{}{
		"task_id":    task.ID,
		"project_id": projectID,
		"status":     models.ReplayStatusRunning,
		"message":    "Replay task started",
	})
}

func (s *Server) runReplayTask(task *models.ReplayTask) {
	task.Status = models.ReplayStatusRunning
	now := time.Now()
	task.StartedAt = &now
	_ = s.store.UpdateReplayTask(task)

	ctx, cancel := context.WithTimeout(context.Background(), task.Timeout*time.Second)
	defer cancel()

	s.activeReplays.Store(task.ID, cancel)

	config := task.Config
	if config == nil {
		config = make(map[string]interface{})
	}
	config["concurrency"] = task.Concurrency
	config["duration"] = task.Duration

	result, err := s.replayer.RunReplay(ctx, task.TargetCategory, config)

	completedAt := time.Now()
	task.CompletedAt = &completedAt

	if err != nil {
		task.Status = models.ReplayStatusFailed
		task.Error = err.Error()
	} else if ctx.Err() == context.DeadlineExceeded {
		task.Status = models.ReplayStatusTimeout
		task.Error = "Task timed out"
	} else if ctx.Err() == context.Canceled {
		task.Status = models.ReplayStatusCancelled
		task.Error = "Task cancelled"
	} else {
		task.Status = models.ReplayStatusCompleted
		resultJSON, _ := json.Marshal(result)
		task.Result = string(resultJSON)
	}

	s.activeReplays.Delete(task.ID)
	_ = s.store.UpdateReplayTask(task)
}

func (s *Server) handleGetReplay(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	taskID := r.PathValue("taskId")

	task, err := s.store.GetReplayTask(taskID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get replay task", err)
		return
	}

	if task == nil {
		s.errorResponse(w, http.StatusNotFound, "Replay task not found", nil)
		return
	}

	if task.ProjectID != projectID {
		s.errorResponse(w, http.StatusNotFound, "Replay task not found in this project", nil)
		return
	}

	response := map[string]interface{}{
		"task_id":        task.ID,
		"project_id":     task.ProjectID,
		"target_category": task.TargetCategory,
		"status":         task.Status,
		"concurrency":    task.Concurrency,
		"duration":       task.Duration,
		"timeout":        task.Timeout,
		"created_at":     task.CreatedAt,
		"started_at":     task.StartedAt,
		"completed_at":   task.CompletedAt,
	}

	if task.Result != "" {
		var result map[string]interface{}
		if err := json.Unmarshal([]byte(task.Result), &result); err == nil {
			response["result"] = result
		} else {
			response["result"] = task.Result
		}
	}

	if task.Error != "" {
		response["error"] = task.Error
	}

	s.jsonResponse(w, http.StatusOK, response)
}

func (s *Server) handleGetWorkers(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	workers, err := s.store.GetWorkerQueues(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get worker queues", err)
		return
	}

	replayTasks, err := s.store.GetReplayTasks(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get replay tasks", err)
		return
	}

	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"project_id":    projectID,
		"worker_queues": workers,
		"replay_tasks":  replayTasks,
	})
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	format := r.PathValue("format")

	project, err := s.store.GetProject(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get project", err)
		return
	}
	if project == nil {
		s.errorResponse(w, http.StatusNotFound, "Project not found", nil)
		return
	}

	results, err := s.store.GetAnalysisResults(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get analysis results", err)
		return
	}

	stats, err := s.store.Stats(projectID)
	if err != nil {
		stats = make(map[string]interface{})
	}

	report := &exporter.ProjectReport{
		Project:         project,
		Stats:           stats,
		AnalysisResults: results,
		GeneratedAt:     time.Now(),
	}

	exportResult, err := exporter.Export(report, format)
	if err != nil {
		s.errorResponse(w, http.StatusBadRequest, "Export failed", err)
		return
	}

	contentTypes := map[string]string{
		"json":     "application/json",
		"csv":      "text/csv; charset=utf-8",
		"md":       "text/markdown; charset=utf-8",
		"markdown": "text/markdown; charset=utf-8",
	}

	ext := format
	if format == "markdown" {
		ext = "md"
	}

	w.Header().Set("Content-Type", contentTypes[format])
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-report.%s", project.Name, ext))
	w.WriteHeader(http.StatusOK)
	w.Write(exportResult.Data)
}

func (s *Server) handleGetStats(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")

	project, err := s.store.GetProject(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get project", err)
		return
	}
	if project == nil {
		s.errorResponse(w, http.StatusNotFound, "Project not found", nil)
		return
	}

	stats, err := s.store.Stats(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get stats", err)
		return
	}

	results, err := s.store.GetAnalysisResults(projectID)
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "Failed to get analysis results", err)
		return
	}

	categoryStats := make(map[string]int)
	severityStats := make(map[string]int)

	for _, r := range results {
		categoryStats[string(r.Category)]++
		severityStats[string(r.Severity)]++
	}

	stats["categories"] = categoryStats
	stats["severities"] = severityStats

	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"project_id": projectID,
		"project":    project,
		"stats":      stats,
	})
}

func (s *Server) jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (s *Server) errorResponse(w http.ResponseWriter, status int, message string, err error) {
	response := map[string]interface{}{
		"error":   message,
		"code":    status,
		"success": false,
	}
	if err != nil {
		response["details"] = err.Error()
	}
	s.jsonResponse(w, status, response)
}

func (s *Server) decodeJSON(r *http.Request, v interface{}) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	defer r.Body.Close()

	if len(body) == 0 {
		return nil
	}

	return json.Unmarshal(body, v)
}
