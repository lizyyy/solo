package main_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"job-signature-api/internal/dal"
	"job-signature-api/internal/handler"
	"job-signature-api/internal/model"
	"job-signature-api/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.GET("/health", handler.Health)
		batches := api.Group("/batches")
		{
			batches.POST("", handler.CreateBatch)
			batches.GET("", handler.ListBatches)
			batches.GET("/:batchId", handler.GetBatchStatus)
			batches.POST("/:batchId/sign", handler.SignBatch)
			batches.POST("/:batchId/verify", handler.VerifyBatch)
			batches.POST("/:batchId/revoke", handler.RevokeBatch)
			batches.GET("/:batchId/history", handler.GetVerifyHistory)
		}
		consumers := api.Group("/consumers")
		{
			consumers.POST("", handler.CreateConsumer)
		}
	}
	return r
}

func makeRequest(t *testing.T, r *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	var reqBody []byte
	if body != nil {
		var err error
		reqBody, err = json.Marshal(body)
		assert.NoError(t, err)
	}

	req, err := http.NewRequest(method, path, bytes.NewBuffer(reqBody))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestMain(m *testing.M) {
	dal.InitDB()
	m.Run()
}

func TestHealth(t *testing.T) {
	r := setupTestRouter()
	w := makeRequest(t, r, "GET", "/api/v1/health", nil)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCreateBatch(t *testing.T) {
	r := setupTestRouter()

	batchNo := fmt.Sprintf("BATCH-%08d", 1001)
	req := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
			{FileName: "file2.txt", FileHash: "hash2", FileSize: 200},
		},
	}

	w := makeRequest(t, r, "POST", "/api/v1/batches", req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp model.CreateBatchResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, batchNo, resp.BatchNo)
	assert.Equal(t, model.JobStatusPending, resp.Status)

	t.Logf("Created batch: %s", resp.BatchID)
}

func TestDuplicateBatch(t *testing.T) {
	r := setupTestRouter()

	batchNo := fmt.Sprintf("BATCH-%08d", 1002)
	req := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", req)
	assert.Equal(t, http.StatusOK, w1.Code)

	w2 := makeRequest(t, r, "POST", "/api/v1/batches", req)
	assert.Equal(t, http.StatusConflict, w2.Code)

	var errResp model.ErrorResponse
	err := json.Unmarshal(w2.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "BATCH_ALREADY_EXISTS", errResp.Code)

	t.Log("Duplicate batch test passed - correctly returns 409 Conflict")
}

func TestSignBatch(t *testing.T) {
	r := setupTestRouter()

	batchNo := fmt.Sprintf("BATCH-%08d", 1003)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
			{FileName: "file2.txt", FileHash: "hash2", FileSize: 200},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	assert.Equal(t, http.StatusOK, w1.Code)

	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	signReq := model.SignBatchRequest{
		BatchID: createResp.BatchID,
		Signer:  "signer1",
	}

	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	assert.Equal(t, http.StatusOK, w2.Code)

	var signResp model.SignBatchResponse
	err := json.Unmarshal(w2.Body.Bytes(), &signResp)
	assert.NoError(t, err)
	assert.NotEmpty(t, signResp.Digest)

	t.Logf("Signed batch with digest: %s", signResp.Digest)
}

func TestSignTwiceNotAllowed(t *testing.T) {
	r := setupTestRouter()

	batchNo := fmt.Sprintf("BATCH-%08d", 1004)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	signReq := model.SignBatchRequest{
		BatchID: createResp.BatchID,
		Signer:  "signer1",
	}

	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	assert.Equal(t, http.StatusOK, w2.Code)

	w3 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	assert.Equal(t, http.StatusBadRequest, w3.Code)

	var errResp model.ErrorResponse
	err := json.Unmarshal(w3.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "STATUS_TRANSITION_NOT_ALLOWED", errResp.Code)

	t.Log("Double sign test passed - correctly prevents signing twice")
}

func TestVerifyWithWrongDigest(t *testing.T) {
	r := setupTestRouter()

	consumer, _ := service.CreateConsumer("test-consumer")

	batchNo := fmt.Sprintf("BATCH-%08d", 1005)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	signReq := model.SignBatchRequest{
		BatchID: createResp.BatchID,
		Signer:  "signer1",
	}
	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	var signResp model.SignBatchResponse
	json.Unmarshal(w2.Body.Bytes(), &signResp)

	verifyReq := model.VerifyRequest{
		BatchID:    createResp.BatchID,
		ConsumerID: consumer.ID,
		Digest:     "wrong_digest_value",
	}

	w3 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/verify", createResp.BatchID), verifyReq)
	assert.Equal(t, http.StatusUnauthorized, w3.Code)

	var errResp model.ErrorResponse
	err := json.Unmarshal(w3.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "DIGEST_MISMATCH", errResp.Code)

	t.Log("Wrong digest test passed - correctly returns 401 Unauthorized")
}

func TestVerifySuccess(t *testing.T) {
	r := setupTestRouter()

	consumer, _ := service.CreateConsumer("test-consumer")

	batchNo := fmt.Sprintf("BATCH-%08d", 1006)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	signReq := model.SignBatchRequest{
		BatchID: createResp.BatchID,
		Signer:  "signer1",
	}
	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	var signResp model.SignBatchResponse
	json.Unmarshal(w2.Body.Bytes(), &signResp)

	verifyReq := model.VerifyRequest{
		BatchID:    createResp.BatchID,
		ConsumerID: consumer.ID,
		Digest:     signResp.Digest,
	}

	w3 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/verify", createResp.BatchID), verifyReq)
	assert.Equal(t, http.StatusOK, w3.Code)

	var verifyResp model.VerifyResponse
	err := json.Unmarshal(w3.Body.Bytes(), &verifyResp)
	assert.NoError(t, err)
	assert.True(t, verifyResp.Success)

	t.Log("Verify success test passed")
}

func TestRevokeBatch(t *testing.T) {
	r := setupTestRouter()

	batchNo := fmt.Sprintf("BATCH-%08d", 1007)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/revoke", createResp.BatchID), nil)
	assert.Equal(t, http.StatusOK, w2.Code)

	w3 := makeRequest(t, r, "GET", fmt.Sprintf("/api/v1/batches/%s", createResp.BatchID), nil)
	assert.Equal(t, http.StatusOK, w3.Code)

	var statusResp model.BatchStatusResponse
	json.Unmarshal(w3.Body.Bytes(), &statusResp)
	assert.Equal(t, model.JobStatusRevoked, statusResp.Status)

	t.Logf("Revoke test passed - batch status is now %s", statusResp.Status)
}

func TestVerifyRevokedBatch(t *testing.T) {
	r := setupTestRouter()

	consumer, _ := service.CreateConsumer("test-consumer")

	batchNo := fmt.Sprintf("BATCH-%08d", 1008)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	signReq := model.SignBatchRequest{
		BatchID: createResp.BatchID,
		Signer:  "signer1",
	}
	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	var signResp model.SignBatchResponse
	json.Unmarshal(w2.Body.Bytes(), &signResp)

	makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/revoke", createResp.BatchID), nil)

	verifyReq := model.VerifyRequest{
		BatchID:    createResp.BatchID,
		ConsumerID: consumer.ID,
		Digest:     signResp.Digest,
	}

	w4 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/verify", createResp.BatchID), verifyReq)
	assert.Equal(t, http.StatusBadRequest, w4.Code)

	var errResp model.ErrorResponse
	err := json.Unmarshal(w4.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "INVALID_STATUS", errResp.Code)

	t.Log("Verify revoked batch test passed - correctly rejects verification")
}

func TestBatchNotFound(t *testing.T) {
	r := setupTestRouter()

	w := makeRequest(t, r, "GET", "/api/v1/batches/nonexistent-batch-id", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)

	var errResp model.ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "BATCH_NOT_FOUND", errResp.Code)

	t.Log("Batch not found test passed")
}

func TestVerifyHistory(t *testing.T) {
	r := setupTestRouter()

	consumer, _ := service.CreateConsumer("test-consumer")

	batchNo := fmt.Sprintf("BATCH-%08d", 1009)
	createReq := model.CreateBatchRequest{
		BatchNo:    batchNo,
		Creator:    "tester",
		ExpireDays: 3,
		Files: []model.FileInfo{
			{FileName: "file1.txt", FileHash: "hash1", FileSize: 100},
		},
	}

	w1 := makeRequest(t, r, "POST", "/api/v1/batches", createReq)
	var createResp model.CreateBatchResponse
	json.Unmarshal(w1.Body.Bytes(), &createResp)

	signReq := model.SignBatchRequest{
		BatchID: createResp.BatchID,
		Signer:  "signer1",
	}
	w2 := makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/sign", createResp.BatchID), signReq)
	var signResp model.SignBatchResponse
	json.Unmarshal(w2.Body.Bytes(), &signResp)

	verifyReq := model.VerifyRequest{
		BatchID:    createResp.BatchID,
		ConsumerID: consumer.ID,
		Digest:     signResp.Digest,
	}
	makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/verify", createResp.BatchID), verifyReq)

	verifyReq.Digest = "wrong_digest"
	makeRequest(t, r, "POST", fmt.Sprintf("/api/v1/batches/%s/verify", createResp.BatchID), verifyReq)

	w5 := makeRequest(t, r, "GET", fmt.Sprintf("/api/v1/batches/%s/history", createResp.BatchID), nil)
	assert.Equal(t, http.StatusOK, w5.Code)

	var history []model.VerifyRecord
	err := json.Unmarshal(w5.Body.Bytes(), &history)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(history), 2)

	t.Logf("Verify history test passed - found %d records", len(history))
}
