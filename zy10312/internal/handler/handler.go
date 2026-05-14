package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"multi-cloud-storage-router/internal/model"
	"multi-cloud-storage-router/internal/service"
	"multi-cloud-storage-router/pkg/errors"
)

type Handler struct {
	store  *service.Store
	router *service.RouterService
}

func NewHandler(store *service.Store, router *service.RouterService) *Handler {
	return &Handler{
		store:  store,
		router: router,
	}
}

func (h *Handler) CreateBucket(w http.ResponseWriter, r *http.Request) {
	var bucket model.Bucket
	if err := json.NewDecoder(r.Body).Decode(&bucket); err != nil {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "invalid request body")).WriteJSON(w)
		return
	}

	if bucket.Name == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "bucket name is required")).WriteJSON(w)
		return
	}

	if err := h.store.CreateBucket(&bucket); err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(bucket).WriteJSON(w)
}

func (h *Handler) ListBuckets(w http.ResponseWriter, r *http.Request) {
	buckets := h.store.ListBuckets()
	errors.NewSuccessResponse(buckets).WriteJSON(w)
}

func (h *Handler) CreateStrategy(w http.ResponseWriter, r *http.Request) {
	var strategy model.RoutingStrategy
	if err := json.NewDecoder(r.Body).Decode(&strategy); err != nil {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "invalid request body")).WriteJSON(w)
		return
	}

	if strategy.Name == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "strategy name is required")).WriteJSON(w)
		return
	}

	if strategy.RetryCount <= 0 {
		strategy.RetryCount = 3
	}

	if err := h.store.CreateStrategy(&strategy); err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(strategy).WriteJSON(w)
}

type CreateUploadRequest struct {
	FileName       string `json:"file_name"`
	FileSize       int64  `json:"file_size"`
	ContentType    string `json:"content_type"`
	StrategyID     string `json:"strategy_id"`
	IdempotencyKey string `json:"idempotency_key"`
}

func (h *Handler) CreateUploadRequest(w http.ResponseWriter, r *http.Request) {
	var req CreateUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "invalid request body")).WriteJSON(w)
		return
	}

	if req.FileName == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "file name is required")).WriteJSON(w)
		return
	}

	if req.StrategyID == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "strategy id is required")).WriteJSON(w)
		return
	}

	_, err := h.store.GetStrategy(req.StrategyID)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	upload := &model.UploadRequest{
		FileName:       req.FileName,
		FileSize:       req.FileSize,
		ContentType:    req.ContentType,
		StrategyID:     req.StrategyID,
		IdempotencyKey: req.IdempotencyKey,
	}

	result, err := h.store.CreateUploadRequest(upload)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(result).WriteJSON(w)
}

func (h *Handler) RouteUpload(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	uploadID = strings.TrimSuffix(uploadID, "/route")

	bucket, err := h.router.RouteUploadRequest(uploadID)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(map[string]interface{}{
		"bucket":    bucket,
		"upload_id": uploadID,
	}).WriteJSON(w)
}

type FailoverRequest struct {
	Reason    string `json:"reason"`
	ErrorCode string `json:"error_code"`
	ErrorMsg  string `json:"error_msg"`
}

func (h *Handler) HandleFailover(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	uploadID = strings.TrimSuffix(uploadID, "/failover")

	var req FailoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "invalid request body")).WriteJSON(w)
		return
	}

	if req.Reason == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "failover reason is required")).WriteJSON(w)
		return
	}

	bucket, err := h.router.HandleUploadFailure(uploadID, model.SwitchReason(req.Reason), req.ErrorCode, req.ErrorMsg)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(map[string]interface{}{
		"new_bucket": bucket,
		"upload_id":  uploadID,
	}).WriteJSON(w)
}

type ChecksumRequest struct {
	Algorithm    string `json:"algorithm"`
	ExpectedHash string `json:"expected_hash"`
	ActualData   []byte `json:"actual_data"`
}

func (h *Handler) VerifyChecksum(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	uploadID = strings.TrimSuffix(uploadID, "/checksum")

	var req ChecksumRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "invalid request body")).WriteJSON(w)
		return
	}

	if req.ExpectedHash == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "expected hash is required")).WriteJSON(w)
		return
	}

	summary, err := h.router.VerifyChecksum(uploadID, model.ChecksumAlgorithm(req.Algorithm), req.ExpectedHash, req.ActualData)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(summary).WriteJSON(w)
}

type LinkRequest struct {
	ObjectKey string `json:"object_key"`
	ExpiresIn int    `json:"expires_in"`
}

func (h *Handler) GenerateLink(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	uploadID = strings.TrimSuffix(uploadID, "/link")

	var req LinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "invalid request body")).WriteJSON(w)
		return
	}

	if req.ObjectKey == "" {
		errors.NewErrorResponse(errors.New(errors.ErrCodeInvalidRequest, "object key is required")).WriteJSON(w)
		return
	}

	expiresIn := time.Hour * 24
	if req.ExpiresIn > 0 {
		expiresIn = time.Second * time.Duration(req.ExpiresIn)
	}

	link, err := h.router.GenerateAccessLink(uploadID, req.ObjectKey, expiresIn)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(link).WriteJSON(w)
}

func (h *Handler) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	uploadID = strings.TrimSuffix(uploadID, "/complete")

	if err := h.router.CompleteUpload(uploadID); err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(map[string]string{
		"status":    "completed",
		"upload_id": uploadID,
	}).WriteJSON(w)
}

func (h *Handler) GetUploadHistory(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	uploadID = strings.TrimSuffix(uploadID, "/history")

	history, err := h.router.GetUploadHistory(uploadID)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(history).WriteJSON(w)
}

func (h *Handler) ListAllHistory(w http.ResponseWriter, r *http.Request) {
	history := h.router.ListUploadHistory()
	errors.NewSuccessResponse(history).WriteJSON(w)
}

func (h *Handler) GetUploadRequest(w http.ResponseWriter, r *http.Request) {
	uploadID := strings.TrimPrefix(r.URL.Path, "/api/uploads/")

	upload, err := h.store.GetUploadRequest(uploadID)
	if err != nil {
		errors.NewErrorResponse(err.(*errors.AppError)).WriteJSON(w)
		return
	}

	errors.NewSuccessResponse(upload).WriteJSON(w)
}
