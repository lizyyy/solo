package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/api-guardian/api-guardian/internal/config"
	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/models"
	"github.com/api-guardian/api-guardian/internal/services"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Server struct {
	db                 *gorm.DB
	cfg                *config.Config
	router             *chi.Mux
	mockService        *services.MockService
	trafficService     *services.TrafficService
	mqService          *services.MessageQueueService
	reportService      *services.ReportService
	consistencyService *services.ConsistencyService
	traceService       *tracing.TraceService
	server             *http.Server
}

func NewServer(cfg *config.Config, mockService *services.MockService) *Server {
	s := &Server{
		db:                 database.GetDB(),
		cfg:                cfg,
		router:             chi.NewRouter(),
		mockService:        mockService,
		trafficService:     services.NewTrafficService(),
		mqService:          services.NewMessageQueueService(),
		reportService:      services.NewReportService(),
		consistencyService: services.NewConsistencyService(),
		traceService:       tracing.NewTraceService(),
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

func (s *Server) setupMiddleware() {
	s.router.Use(middleware.RequestID)
	s.router.Use(middleware.RealIP)
	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
	s.router.Use(middleware.Timeout(60 * time.Second))

	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
}

func (s *Server) setupRoutes() {
	s.router.Get("/health", s.handleHealth)

	s.router.Route("/api/v1", func(r chi.Router) {
		r.Route("/apis", func(r chi.Router) {
			r.Get("/", s.listAPIs)
			r.Post("/", s.createAPI)
			r.Get("/{id}", s.getAPI)
			r.Put("/{id}", s.updateAPI)
			r.Delete("/{id}", s.deleteAPI)
		})

		r.Route("/mocks", func(r chi.Router) {
			r.Post("/", s.createMock)
			r.Get("/{id}", s.getMock)
			r.Put("/{id}", s.updateMock)
			r.Delete("/{id}", s.deleteMock)
		})

		r.Route("/traffic", func(r chi.Router) {
			r.Get("/", s.listTrafficTests)
			r.Post("/", s.createTrafficTest)
			r.Get("/{id}", s.getTrafficTest)
			r.Post("/{id}/start", s.startTrafficTest)
			r.Post("/{id}/stop", s.stopTrafficTest)
			r.Get("/{id}/report", s.getTrafficReport)
			r.Get("/{id}/export/csv", s.exportTrafficReportCSV)
			r.Get("/{id}/export/json", s.exportTrafficReportJSON)
		})

		r.Route("/mq", func(r chi.Router) {
			r.Get("/", s.listMQSimulations)
			r.Post("/", s.createMQSimulation)
			r.Get("/{id}", s.getMQSimulation)
			r.Post("/{id}/start", s.startMQSimulation)
			r.Post("/{id}/stop", s.stopMQSimulation)
		})

		r.Route("/consistency", func(r chi.Router) {
			r.Post("/check/{id}", s.runConsistencyCheck)
			r.Get("/{id}", s.listConsistencyChecks)
		})

		r.Route("/tracing", func(r chi.Router) {
			r.Get("/trace/{trace_id}", s.getTrace)
			r.Get("/errors", s.getErrorTraces)
			r.Get("/search", s.searchTraces)
		})

		r.Route("/issues", func(r chi.Router) {
			r.Get("/", s.listIssueReports)
			r.Get("/{id}", s.getIssueReport)
			r.Put("/{id}", s.updateIssueReport)
		})
	})
}

func (s *Server) Start() error {
	addr := fmt.Sprintf(":%d", s.cfg.Server.HTTPPort)
	s.server = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	logger.Info("Starting API server", zap.String("addr", addr))
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("API server error", zap.Error(err))
		}
	}()

	return nil
}

func (s *Server) Stop(ctx context.Context) error {
	if s.server != nil {
		return s.server.Shutdown(ctx)
	}
	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "api-guardian",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]interface{}{
		"error":   true,
		"message": message,
		"code":    status,
	})
}

func getIDParam(r *http.Request) (uint, error) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}

func (s *Server) listAPIs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	_, span := tracing.Start(ctx, "api.list_apis")
	defer span.End()

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var apis []models.APIDefinition
	var total int64

	s.db.Model(&models.APIDefinition{}).Count(&total)
	offset := (page - 1) * pageSize
	s.db.Preload("MockResponses").Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&apis)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":      apis,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (s *Server) createAPI(w http.ResponseWriter, r *http.Request) {
	var api models.APIDefinition
	if err := json.NewDecoder(r.Body).Decode(&api); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.db.Create(&api).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := s.mockService.AddMapping(r.Context(), &api); err != nil {
		logger.Error("Failed to add mapping to mock service", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "Failed to register mock mapping: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, api)
}

func (s *Server) getAPI(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var api models.APIDefinition
	if err := s.db.Preload("MockResponses").First(&api, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "API not found")
		return
	}

	writeJSON(w, http.StatusOK, api)
}

func (s *Server) updateAPI(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var api models.APIDefinition
	if err := s.db.First(&api, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "API not found")
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&api); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	api.ID = id
	if err := s.db.Save(&api).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := s.mockService.UpdateMapping(r.Context(), &api); err != nil {
		logger.Error("Failed to update mapping in mock service", zap.Error(err))
		writeError(w, http.StatusInternalServerError, "Failed to update mock mapping: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, api)
}

func (s *Server) deleteAPI(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var api models.APIDefinition
	if err := s.db.First(&api, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "API not found")
		return
	}

	if err := s.db.Delete(&api).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.mockService.RemoveMappingByID(r.Context(), id)

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) createMock(w http.ResponseWriter, r *http.Request) {
	var mock models.MockResponse
	if err := json.NewDecoder(r.Body).Decode(&mock); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.db.Create(&mock).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := s.mockService.RefreshMapping(r.Context(), mock.APIDefinitionID); err != nil {
		logger.Error("Failed to refresh mock mapping after creating response", zap.Error(err), zap.Uint("api_id", mock.APIDefinitionID))
	}

	writeJSON(w, http.StatusCreated, mock)
}

func (s *Server) getMock(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var mock models.MockResponse
	if err := s.db.First(&mock, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "Mock not found")
		return
	}

	writeJSON(w, http.StatusOK, mock)
}

func (s *Server) updateMock(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var mock models.MockResponse
	if err := s.db.First(&mock, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "Mock not found")
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&mock); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	apiID := mock.APIDefinitionID
	mock.ID = id
	if err := s.db.Save(&mock).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := s.mockService.RefreshMapping(r.Context(), apiID); err != nil {
		logger.Error("Failed to refresh mock mapping after updating response", zap.Error(err), zap.Uint("api_id", apiID))
	}

	writeJSON(w, http.StatusOK, mock)
}

func (s *Server) deleteMock(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var mock models.MockResponse
	if err := s.db.First(&mock, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "Mock not found")
		return
	}

	apiID := mock.APIDefinitionID

	if err := s.db.Delete(&mock).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := s.mockService.RefreshMapping(r.Context(), apiID); err != nil {
		logger.Error("Failed to refresh mock mapping after deleting response", zap.Error(err), zap.Uint("api_id", apiID))
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listTrafficTests(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	tests, total, err := s.trafficService.ListTests(r.Context(), page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":      tests,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (s *Server) createTrafficTest(w http.ResponseWriter, r *http.Request) {
	var test models.TrafficTest
	if err := json.NewDecoder(r.Body).Decode(&test); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.trafficService.CreateTest(r.Context(), &test); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, test)
}

func (s *Server) getTrafficTest(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	test, err := s.trafficService.GetTestStatus(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Test not found")
		return
	}

	writeJSON(w, http.StatusOK, test)
}

func (s *Server) startTrafficTest(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	if err := s.trafficService.StartTest(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Test started",
		"test_id": id,
	})
}

func (s *Server) stopTrafficTest(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	if err := s.trafficService.StopTest(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Test stopped",
		"test_id": id,
	})
}

func (s *Server) getTrafficReport(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	report, err := s.reportService.GenerateTrafficReport(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, report)
}

func (s *Server) exportTrafficReportCSV(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	data, err := s.reportService.ExportTrafficReportAsCSV(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=traffic_report_%d.csv", id))
	w.Write(data)
}

func (s *Server) exportTrafficReportJSON(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	data, err := s.reportService.ExportTrafficReportAsJSON(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=traffic_report_%d.json", id))
	w.Write(data)
}

func (s *Server) listMQSimulations(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	sims, total, err := s.mqService.ListSimulations(r.Context(), page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":      sims,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (s *Server) createMQSimulation(w http.ResponseWriter, r *http.Request) {
	var sim models.MessageQueueSimulation
	if err := json.NewDecoder(r.Body).Decode(&sim); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.mqService.CreateSimulation(r.Context(), &sim); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, sim)
}

func (s *Server) getMQSimulation(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	sim, err := s.mqService.GetSimulation(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Simulation not found")
		return
	}

	writeJSON(w, http.StatusOK, sim)
}

func (s *Server) startMQSimulation(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	if err := s.mqService.StartSimulation(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Simulation started",
		"sim_id":  id,
	})
}

func (s *Server) stopMQSimulation(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	if err := s.mqService.StopSimulation(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Simulation stopped",
		"sim_id":  id,
	})
}

func (s *Server) runConsistencyCheck(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req struct {
		RealURL string `json:"real_url"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	check, err := s.consistencyService.RunFullConsistencyCheck(r.Context(), id, req.RealURL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, check)
}

func (s *Server) listConsistencyChecks(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	checks, total, err := s.consistencyService.ListChecks(r.Context(), id, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":      checks,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (s *Server) getTrace(w http.ResponseWriter, r *http.Request) {
	traceID := chi.URLParam(r, "trace_id")
	records, err := s.traceService.GetTraceByID(traceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, records)
}

func (s *Server) getErrorTraces(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 50
	}

	records, err := s.traceService.GetErrorTraces(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, records)
}

func (s *Server) searchTraces(w http.ResponseWriter, r *http.Request) {
	serviceName := r.URL.Query().Get("service")
	operationName := r.URL.Query().Get("operation")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 100
	}

	records, err := s.traceService.SearchTraces(serviceName, operationName, time.Time{}, time.Time{}, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, records)
}

func (s *Server) listIssueReports(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	severity := r.URL.Query().Get("severity")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	reports, total, err := s.reportService.ListIssueReports(r.Context(), status, severity, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":      reports,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (s *Server) getIssueReport(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	report, err := s.reportService.GetIssueReport(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Report not found")
		return
	}

	writeJSON(w, http.StatusOK, report)
}

func (s *Server) updateIssueReport(w http.ResponseWriter, r *http.Request) {
	id, err := getIDParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var report models.IssueReport
	if err := s.db.First(&report, id).Error; err != nil {
		writeError(w, http.StatusNotFound, "Report not found")
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	report.ID = id
	if err := s.reportService.UpdateIssueReport(r.Context(), &report); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, report)
}
