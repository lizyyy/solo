package handlers

import (
	"net/http"
	"qa-tracking-system/services"
	"qa-tracking-system/utils"
	"strconv"

	"github.com/gin-gonic/gin"
)

type CreateBatchRequest struct {
	BatchNo     string `json:"batch_no" binding:"required"`
	ProductName string `json:"product_name" binding:"required"`
	CreatedBy   string `json:"created_by" binding:"required"`
}

func CreateBatch(c *gin.Context) {
	var req CreateBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch, err := services.CreateBatch(req.BatchNo, req.ProductName, req.CreatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, batch)
}

func ListBatches(c *gin.Context) {
	batchNo := c.Query("batch_no")
	status := c.Query("status")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	batches, total, err := services.ListBatches(batchNo, status, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  batches,
		"total": total,
	})
}

func GetBatch(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	batch, err := services.GetBatch(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "批次不存在"})
		return
	}
	c.JSON(http.StatusOK, batch)
}

type ProcessBatchRequest struct {
	Handler string  `json:"handler" binding:"required"`
	Remark  *string `json:"remark"`
}

func ProcessBatch(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req ProcessBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch, err := services.ProcessBatch(uint(id), req.Handler, req.Remark)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, batch)
}

type ReturnBatchRequest struct {
	Handler string `json:"handler" binding:"required"`
	Reason  string `json:"reason" binding:"required"`
}

func ReturnBatch(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req ReturnBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch, err := services.ReturnBatch(uint(id), req.Handler, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, batch)
}

func ApproveBatch(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req ProcessBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch, err := services.ApproveBatch(uint(id), req.Handler, req.Remark)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, batch)
}

func RejectBatch(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req ReturnBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch, err := services.RejectBatch(uint(id), req.Handler, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, batch)
}

func ImportSamplesCSV(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请上传CSV文件"})
		return
	}
	defer file.Close()

	batchID, _ := strconv.Atoi(c.PostForm("batch_id"))

	records, err := utils.ParseCSV(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	samples, err := services.ImportSamples(uint(batchID), records)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "导入成功",
		"count":   len(samples),
		"data":    samples,
	})
}

func ImportProtocolJSON(c *gin.Context) {
	var protocolData map[string]interface{}
	if err := c.ShouldBindJSON(&protocolData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batchID, _ := strconv.Atoi(c.Query("batch_id"))

	protocol, err := services.ImportTestProtocol(uint(batchID), protocolData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, protocol)
}

func ImportChamberRecords(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请上传CSV文件"})
		return
	}
	defer file.Close()

	sampleID, _ := strconv.Atoi(c.PostForm("sample_id"))

	records, err := utils.ParseCSV(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	chamberRecords, err := services.ImportChamberRecords(uint(sampleID), records)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "导入成功",
		"count":   len(chamberRecords),
		"data":    chamberRecords,
	})
}
