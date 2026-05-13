package model

type CreateBatchRequest struct {
	BatchNo     string   `json:"batch_no" binding:"required"`
	Creator     string   `json:"creator" binding:"required"`
	Files       []FileInfo `json:"files" binding:"required,min=1"`
	ExpireDays  int      `json:"expire_days" binding:"min=1"`
}

type FileInfo struct {
	FileName string `json:"file_name" binding:"required"`
	FileHash string `json:"file_hash" binding:"required"`
	FileSize int64  `json:"file_size" binding:"min=1"`
	FilePath string `json:"file_path"`
}

type CreateBatchResponse struct {
	BatchID string    `json:"batch_id"`
	BatchNo string    `json:"batch_no"`
	Status  JobStatus `json:"status"`
}

type SignBatchRequest struct {
	BatchID   string `json:"batch_id" binding:"required"`
	Signer    string `json:"signer" binding:"required"`
	Algorithm string `json:"algorithm"`
}

type SignBatchResponse struct {
	BatchID string `json:"batch_id"`
	Digest  string `json:"digest"`
}

type VerifyRequest struct {
	BatchID    string `json:"batch_id" binding:"required"`
	ConsumerID string `json:"consumer_id" binding:"required"`
	Digest     string `json:"digest" binding:"required"`
}

type VerifyResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type BatchStatusResponse struct {
	BatchID     string    `json:"batch_id"`
	BatchNo     string    `json:"batch_no"`
	Status      JobStatus `json:"status"`
	TotalFiles  int       `json:"total_files"`
	ExpireAt    string    `json:"expire_at"`
	CreatedAt   string    `json:"created_at"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
