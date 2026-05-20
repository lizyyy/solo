package handlers

import (
	"net/http"
	"qa-tracking-system/config"
	"qa-tracking-system/models"
	"qa-tracking-system/services"
	"qa-tracking-system/utils"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func ListSamples(c *gin.Context) {
	batchID, _ := strconv.Atoi(c.Query("batch_id"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	var samples []models.Sample
	var total int64

	query := config.DB.Model(&models.Sample{})
	if batchID > 0 {
		query = query.Where("batch_id = ?", batchID)
	}

	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := query.Offset(offset).Limit(limit).
		Order("created_at DESC").
		Preload("SampleNodes").
		Preload("ChamberRecords").
		Find(&samples).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  samples,
		"total": total,
	})
}

func TraceSample(c *gin.Context) {
	sampleID := c.Param("sample_id")

	var sample models.Sample
	if err := config.DB.Where("sample_id = ?", sampleID).
		Preload("SampleNodes").
		Preload("ChamberRecords").
		First(&sample).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "样品不存在"})
		return
	}

	c.JSON(http.StatusOK, sample)
}

func ListProtocols(c *gin.Context) {
	batchID, _ := strconv.Atoi(c.Query("batch_id"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	var protocols []models.TestProtocol
	var total int64

	query := config.DB.Model(&models.TestProtocol{})
	if batchID > 0 {
		query = query.Where("batch_id = ?", batchID)
	}

	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := query.Offset(offset).Limit(limit).
		Order("created_at DESC").
		Find(&protocols).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  protocols,
		"total": total,
	})
}

func ListChamberRecords(c *gin.Context) {
	chamberID := c.Query("chamber_id")
	sampleID, _ := strconv.Atoi(c.Query("sample_id"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	var records []models.ChamberRecord
	var total int64

	query := config.DB.Model(&models.ChamberRecord{})
	if chamberID != "" {
		query = query.Where("chamber_id = ?", chamberID)
	}
	if sampleID > 0 {
		query = query.Where("sample_id = ?", sampleID)
	}

	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := query.Offset(offset).Limit(limit).
		Order("timestamp DESC").
		Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  records,
		"total": total,
	})
}

func GetChamberHistory(c *gin.Context) {
	chamberID := c.Param("chamber_id")
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	var startTime, endTime time.Time
	if startTimeStr != "" {
		startTime, _ = utils.ParseTime(startTimeStr)
	}
	if endTimeStr != "" {
		endTime, _ = utils.ParseTime(endTimeStr)
	}

	records, err := services.QueryByChamber(chamberID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

func ListSampleNodes(c *gin.Context) {
	sampleID, _ := strconv.Atoi(c.Query("sample_id"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	nodes, total, err := services.ListSampleNodes(uint(sampleID), offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  nodes,
		"total": total,
	})
}

func TraceSampleNode(c *gin.Context) {
	nodeID := c.Param("node_id")
	trace, err := services.GetSampleNodeTrace(nodeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "节点不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trace": trace,
		"depth": len(trace),
	})
}

type CreateExceptionRequest struct {
	BatchID      *uint                  `json:"batch_id"`
	SampleID     *uint                  `json:"sample_id"`
	ChamberID    *string                `json:"chamber_id"`
	SampleNodeID *string                `json:"sample_node_id"`
	EventType    models.ExceptionType   `json:"event_type" binding:"required"`
	Severity     string                 `json:"severity" binding:"required"`
	Description  string                 `json:"description" binding:"required"`
	Reason       string                 `json:"reason" binding:"required"`
	Handler      string                 `json:"handler" binding:"required"`
	Resolution   *string                `json:"resolution"`
}

func CreateException(c *gin.Context) {
	var req CreateExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := services.CreateException(
		req.EventType,
		req.BatchID,
		req.SampleID,
		req.ChamberID,
		req.SampleNodeID,
		req.Severity,
		req.Description,
		req.Reason,
		req.Handler,
		req.Resolution,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func ListExceptions(c *gin.Context) {
	eventType := c.Query("event_type")
	batchID := c.Query("batch_id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	exceptions, total, err := services.ListExceptions(eventType, batchID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  exceptions,
		"total": total,
	})
}

func QueryByBatchNo(c *gin.Context) {
	batchNo := c.Param("batch_no")
	batch, err := services.QueryByBatchNo(batchNo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "批次不存在"})
		return
	}
	c.JSON(http.StatusOK, batch)
}

func QueryByChamber(c *gin.Context) {
	chamberID := c.Param("chamber_id")
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	var startTime, endTime time.Time
	if startTimeStr != "" {
		startTime, _ = utils.ParseTime(startTimeStr)
	}
	if endTimeStr != "" {
		endTime, _ = utils.ParseTime(endTimeStr)
	}

	records, err := services.QueryByChamber(chamberID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

func QueryBySampleNode(c *gin.Context) {
	nodeID := c.Param("node_id")
	node, err := services.QueryBySampleNode(nodeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "节点不存在"})
		return
	}
	c.JSON(http.StatusOK, node)
}

func ExportBatch(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	data, err := services.ExportBatch(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=batch_export_"+strconv.Itoa(id)+".csv")
	c.Data(http.StatusOK, "text/csv", data)
}

func ExportQueryResults(c *gin.Context) {
	batchNo := c.Query("batch_no")
	chamberID := c.Query("chamber_id")
	nodeID := c.Query("node_id")
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	var startTime, endTime time.Time
	if startTimeStr != "" {
		startTime, _ = utils.ParseTime(startTimeStr)
	}
	if endTimeStr != "" {
		endTime, _ = utils.ParseTime(endTimeStr)
	}

	data, count, err := services.ExportQueryResults(batchNo, chamberID, nodeID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=query_export_"+time.Now().Format("20060102150405")+".csv")
	c.Header("X-Export-Count", strconv.Itoa(count))
	c.Data(http.StatusOK, "text/csv", data)
}
