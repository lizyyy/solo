package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"job-signature-api/internal/dal"
	"job-signature-api/internal/model"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrBatchAlreadyExists   = errors.New("batch already exists")
	ErrBatchNotFound        = errors.New("batch not found")
	ErrInvalidStatus        = errors.New("invalid status")
	ErrStatusTransitionNotAllowed = errors.New("status transition not allowed")
	ErrBatchExpired         = errors.New("batch expired")
	ErrVerifyCountExceeded  = errors.New("verify count exceeded")
	ErrDigestMismatch       = errors.New("digest mismatch")
	ErrConsumerNotFound     = errors.New("consumer not found")
	ErrConsumerInactive     = errors.New("consumer inactive")
)

func isValidStatusTransition(from, to model.JobStatus) bool {
	transitions := map[model.JobStatus][]model.JobStatus{
		model.JobStatusPending:  {model.JobStatusSigned, model.JobStatusRevoked},
		model.JobStatusSigned:   {model.JobStatusVerified, model.JobStatusExpired, model.JobStatusRevoked},
		model.JobStatusVerified: {model.JobStatusExpired, model.JobStatusRevoked},
	}

	allowed, exists := transitions[from]
	if !exists {
		return false
	}

	for _, allowedStatus := range allowed {
		if allowedStatus == to {
			return true
		}
	}
	return false
}

func generateID() string {
	return strings.ReplaceAll(uuid.New().String(), "-", "")
}

func CreateBatch(req *model.CreateBatchRequest) (*model.CreateBatchResponse, error) {
	existingBatch, _ := dal.GetJobBatchByBatchNo(req.BatchNo)
	if existingBatch != nil {
		return nil, ErrBatchAlreadyExists
	}

	batchID := generateID()
	now := time.Now()
	expireDays := req.ExpireDays
	if expireDays <= 0 {
		expireDays = 7
	}

	batch := &model.JobBatch{
		ID:         batchID,
		BatchNo:    req.BatchNo,
		Creator:    req.Creator,
		TotalFiles: len(req.Files),
		Status:     model.JobStatusPending,
		ExpireAt:   now.AddDate(0, 0, expireDays),
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := dal.CreateJobBatch(batch); err != nil {
		return nil, fmt.Errorf("create job batch failed: %w", err)
	}

	resultFiles := make([]model.ResultFile, len(req.Files))
	for i, file := range req.Files {
		resultFiles[i] = model.ResultFile{
			ID:        generateID(),
			BatchID:   batchID,
			FileIndex: i,
			FileName:  file.FileName,
			FileHash:  file.FileHash,
			FileSize:  file.FileSize,
			FilePath:  file.FilePath,
			CreatedAt: now,
		}
	}

	if err := dal.CreateResultFiles(resultFiles); err != nil {
		return nil, fmt.Errorf("create result files failed: %w", err)
	}

	strategy := &model.ExpireStrategy{
		ID:                 generateID(),
		BatchID:            batchID,
		StrategyType:       "time_count",
		ExpireDays:         expireDays,
		MaxVerifyCount:     100,
		CurrentVerifyCount: 0,
		CreatedAt:          now,
	}
	if err := dal.CreateExpireStrategy(strategy); err != nil {
		return nil, fmt.Errorf("create expire strategy failed: %w", err)
	}

	return &model.CreateBatchResponse{
		BatchID: batchID,
		BatchNo: batch.BatchNo,
		Status:  batch.Status,
	}, nil
}

func SignBatch(req *model.SignBatchRequest) (*model.SignBatchResponse, error) {
	batch, err := dal.GetJobBatchByID(req.BatchID)
	if err != nil {
		return nil, ErrBatchNotFound
	}

	if batch.Status != model.JobStatusPending {
		return nil, ErrStatusTransitionNotAllowed
	}

	if time.Now().After(batch.ExpireAt) {
		return nil, ErrBatchExpired
	}

	files, err := dal.GetResultFilesByBatchID(req.BatchID)
	if err != nil {
		return nil, fmt.Errorf("get result files failed: %w", err)
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].FileIndex < files[j].FileIndex
	})

	var hashes []string
	for _, file := range files {
		hashes = append(hashes, file.FileHash)
	}
	combinedHash := strings.Join(hashes, "|")

	sha256Hash := sha256.Sum256([]byte(combinedHash))
	digest := hex.EncodeToString(sha256Hash[:])

	algorithm := req.Algorithm
	if algorithm == "" {
		algorithm = "SHA256-RSA"
	}

	signatureDigest := &model.SignatureDigest{
		ID:        generateID(),
		BatchID:   req.BatchID,
		Algorithm: algorithm,
		Digest:    digest,
		Signer:    req.Signer,
		SignedAt:  time.Now(),
		CreatedAt: time.Now(),
	}

	if err := dal.CreateSignatureDigest(signatureDigest); err != nil {
		return nil, fmt.Errorf("create signature digest failed: %w", err)
	}

	if err := dal.UpdateJobBatchStatus(req.BatchID, model.JobStatusSigned); err != nil {
		return nil, fmt.Errorf("update batch status failed: %w", err)
	}

	return &model.SignBatchResponse{
		BatchID: req.BatchID,
		Digest:  digest,
	}, nil
}

func VerifyBatch(req *model.VerifyRequest, clientIP string) (*model.VerifyResponse, error) {
	batch, err := dal.GetJobBatchByID(req.BatchID)
	if err != nil {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "batch not found", clientIP)
		return nil, ErrBatchNotFound
	}

	consumer, err := dal.GetConsumerByID(req.ConsumerID)
	if err != nil {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "consumer not found", clientIP)
		return nil, ErrConsumerNotFound
	}

	if !consumer.IsActive {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "consumer inactive", clientIP)
		return nil, ErrConsumerInactive
	}

	if batch.Status == model.JobStatusExpired || batch.Status == model.JobStatusRevoked {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, fmt.Sprintf("batch status: %s", batch.Status), clientIP)
		return nil, ErrInvalidStatus
	}

	if time.Now().After(batch.ExpireAt) {
		dal.UpdateJobBatchStatus(req.BatchID, model.JobStatusExpired)
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "batch expired", clientIP)
		return nil, ErrBatchExpired
	}

	strategy, err := dal.GetExpireStrategyByBatchID(req.BatchID)
	if err != nil {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "expire strategy not found", clientIP)
		return nil, fmt.Errorf("get expire strategy failed: %w", err)
	}

	if strategy.CurrentVerifyCount >= strategy.MaxVerifyCount {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "verify count exceeded", clientIP)
		return nil, ErrVerifyCountExceeded
	}

	storedDigest, err := dal.GetSignatureDigestByBatchID(req.BatchID)
	if err != nil {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "signature digest not found", clientIP)
		return nil, fmt.Errorf("get signature digest failed: %w", err)
	}

	if storedDigest.Digest != req.Digest {
		createVerifyRecord(req.BatchID, req.ConsumerID, false, "digest mismatch", clientIP)
		return nil, ErrDigestMismatch
	}

	dal.IncrementVerifyCount(req.BatchID)
	createVerifyRecord(req.BatchID, req.ConsumerID, true, "", clientIP)

	if batch.Status == model.JobStatusSigned {
		dal.UpdateJobBatchStatus(req.BatchID, model.JobStatusVerified)
	}

	return &model.VerifyResponse{
		Success: true,
		Message: "verify success",
	}, nil
}

func createVerifyRecord(batchID, consumerID string, result bool, errMsg, clientIP string) {
	record := &model.VerifyRecord{
		ID:           generateID(),
		BatchID:      batchID,
		ConsumerID:   consumerID,
		VerifyResult: result,
		ErrorMessage: errMsg,
		VerifyAt:     time.Now(),
		ClientIP:     clientIP,
	}
	dal.CreateVerifyRecord(record)
}

func GetBatchStatus(batchID string) (*model.BatchStatusResponse, error) {
	batch, err := dal.GetJobBatchByID(batchID)
	if err != nil {
		return nil, ErrBatchNotFound
	}

	return &model.BatchStatusResponse{
		BatchID:    batch.ID,
		BatchNo:    batch.BatchNo,
		Status:     batch.Status,
		TotalFiles: batch.TotalFiles,
		ExpireAt:   batch.ExpireAt.Format(time.RFC3339),
		CreatedAt:  batch.CreatedAt.Format(time.RFC3339),
	}, nil
}

func GetVerifyHistory(batchID string) ([]model.VerifyRecord, error) {
	return dal.GetVerifyRecordsByBatchID(batchID)
}

func ListBatches(status model.JobStatus, limit, offset int) ([]model.JobBatch, error) {
	return dal.ListJobBatches(status, limit, offset)
}

func RevokeBatch(batchID string) error {
	batch, err := dal.GetJobBatchByID(batchID)
	if err != nil {
		return ErrBatchNotFound
	}

	if batch.Status == model.JobStatusRevoked || batch.Status == model.JobStatusExpired {
		return ErrStatusTransitionNotAllowed
	}

	return dal.UpdateJobBatchStatus(batchID, model.JobStatusRevoked)
}

func CreateConsumer(name string) (*model.Consumer, error) {
	consumer := &model.Consumer{
		ID:        generateID(),
		Name:      name,
		AppKey:    generateID()[:16],
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := dal.CreateConsumer(consumer); err != nil {
		return nil, fmt.Errorf("create consumer failed: %w", err)
	}

	return consumer, nil
}

func generateRSAKeys() (privateKey *rsa.PrivateKey, publicKeyPEM string, err error) {
	privateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, "", err
	}

	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return nil, "", err
	}

	publicKeyPEM = string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	}))

	return privateKey, publicKeyPEM, nil
}

func signWithPrivateKey(privateKey *rsa.PrivateKey, data string) (string, error) {
	hashed := sha256.Sum256([]byte(data))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}
