package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"performance-tracker/internal/models"
	"performance-tracker/internal/services"
	"performance-tracker/pkg/logger"

	"github.com/gorilla/mux"
)

type ProjectHandler struct {
	projectService *services.ProjectService
}

func NewProjectHandler(projectService *services.ProjectService) *ProjectHandler {
	return &ProjectHandler{projectService: projectService}
}

func (h *ProjectHandler) RegisterRoutes(router *mux.Router) {
	projectsRouter := router.PathPrefix("/projects").Subrouter()
	projectsRouter.HandleFunc("", h.CreateProject).Methods("POST")
	projectsRouter.HandleFunc("", h.ListProjects).Methods("GET")
	projectsRouter.HandleFunc("/{id:[0-9]+}", h.GetProject).Methods("GET")
	projectsRouter.HandleFunc("/{id:[0-9]+}", h.UpdateProject).Methods("PUT")
	projectsRouter.HandleFunc("/{id:[0-9]+}", h.DeleteProject).Methods("DELETE")
	projectsRouter.HandleFunc("/name/{name}", h.GetProjectByName).Methods("GET")
	projectsRouter.HandleFunc("/{id:[0-9]+}/details", h.GetProjectWithDetails).Methods("GET")
}

func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var project models.Project
	if err := json.NewDecoder(r.Body).Decode(&project); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if strings.TrimSpace(project.Name) == "" {
		sendErrorResponse(w, http.StatusBadRequest, "Project name is required")
		return
	}

	// 检查项目名称是否已存在
	existingProject, err := h.projectService.GetProjectByName(ctx, project.Name)
	if err == nil && existingProject != nil {
		sendErrorResponse(w, http.StatusConflict, "Project with name '"+project.Name+"' already exists")
		return
	}

	if err := h.projectService.CreateProject(ctx, &project); err != nil {
		logger.Errorf("Failed to create project: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to create project: "+err.Error())
		return
	}

	logger.Infof("Project created successfully: %s (ID: %d)", project.Name, project.ID)
	sendSuccessResponse(w, http.StatusCreated, project, "Project created successfully")
}

func (h *ProjectHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	projects, err := h.projectService.ListProjects(ctx)
	if err != nil {
		logger.Errorf("Failed to list projects: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to list projects: "+err.Error())
		return
	}

	sendSuccessResponse(w, http.StatusOK, projects, "")
}

func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid project ID: "+err.Error())
		return
	}

	project, err := h.projectService.GetProjectByID(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get project: %v", err)
		sendErrorResponse(w, http.StatusNotFound, "Project not found")
		return
	}

	sendSuccessResponse(w, http.StatusOK, project, "")
}

func (h *ProjectHandler) GetProjectByName(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	name := vars["name"]

	project, err := h.projectService.GetProjectByName(ctx, name)
	if err != nil {
		logger.Errorf("Failed to get project by name: %v", err)
		sendErrorResponse(w, http.StatusNotFound, "Project not found")
		return
	}

	sendSuccessResponse(w, http.StatusOK, project, "")
}

func (h *ProjectHandler) GetProjectWithDetails(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid project ID: "+err.Error())
		return
	}

	project, err := h.projectService.GetProjectWithDetails(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get project with details: %v", err)
		sendErrorResponse(w, http.StatusNotFound, "Project not found")
		return
	}

	sendSuccessResponse(w, http.StatusOK, project, "")
}

func (h *ProjectHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid project ID: "+err.Error())
		return
	}

	// 检查项目是否存在
	existingProject, err := h.projectService.GetProjectByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Project not found")
		return
	}

	var updatedProject models.Project
	if err := json.NewDecoder(r.Body).Decode(&updatedProject); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 保持原有的创建时间和ID
	updatedProject.ID = existingProject.ID
	updatedProject.CreatedAt = existingProject.CreatedAt

	// 如果名称更改，检查新名称是否已存在
	if updatedProject.Name != existingProject.Name {
		existingByName, err := h.projectService.GetProjectByName(ctx, updatedProject.Name)
		if err == nil && existingByName != nil && existingByName.ID != existingProject.ID {
			sendErrorResponse(w, http.StatusConflict, "Project with name '"+updatedProject.Name+"' already exists")
			return
		}
	}

	if err := h.projectService.UpdateProject(ctx, &updatedProject); err != nil {
		logger.Errorf("Failed to update project: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to update project: "+err.Error())
		return
	}

	logger.Infof("Project updated successfully: %s (ID: %d)", updatedProject.Name, updatedProject.ID)
	sendSuccessResponse(w, http.StatusOK, updatedProject, "Project updated successfully")
}

func (h *ProjectHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid project ID: "+err.Error())
		return
	}

	// 检查项目是否存在
	_, err = h.projectService.GetProjectByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Project not found")
		return
	}

	if err := h.projectService.DeleteProject(ctx, uint(id)); err != nil {
		logger.Errorf("Failed to delete project: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to delete project: "+err.Error())
		return
	}

	logger.Infof("Project deleted successfully: ID %d", id)
	sendSuccessResponse(w, http.StatusOK, nil, "Project deleted successfully")
}

func sendSuccessResponse(w http.ResponseWriter, statusCode int, data interface{}, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := models.APIResponse{
		Success: true,
		Data:    data,
		Message: message,
	}

	json.NewEncoder(w).Encode(response)
}

func sendErrorResponse(w http.ResponseWriter, statusCode int, errorMessage string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := models.APIResponse{
		Success: false,
		Error:   errorMessage,
	}

	json.NewEncoder(w).Encode(response)
}
