package handlers

import (
	"car-wash-queue-api/models"
	"car-wash-queue-api/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func GenerateReport(c *gin.Context) {
	var req struct {
		Date string `json:"date"`
	}
	c.ShouldBindJSON(&req)

	report, err := services.GenerateDailyReport(req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "生成报告失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    report,
	})
}

func GetReportList(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	reports, err := services.GetReportList(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询报告列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    reports,
	})
}

func ExportReport(c *gin.Context) {
	date := c.Query("date")

	csv, filename, _, err := services.ExportReportToCSV(date)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "导出报告失败",
		})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")
	c.String(http.StatusOK, "\uFEFF"+csv)
}

func GetOvernumberRecords(c *gin.Context) {
	records, err := services.GetOvernumberRecords()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询过号记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    records,
	})
}

func GetExceptionLogs(c *gin.Context) {
	limitStr := c.Query("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	logs, err := services.GetExceptionLogs(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询异常日志失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    logs,
	})
}
