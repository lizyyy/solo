package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"visitor-pass/internal/auth"
	"visitor-pass/internal/model"
	"visitor-pass/internal/repository"
	"visitor-pass/internal/service"
)

var reconcileService = service.NewReconciliationService()

func Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	user, err := repository.GetUserByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器错误"})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	if !auth.CheckPassword(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":    token,
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
	})
}

type Pagination struct {
	Page  int `form:"page,default=1"`
	Limit int `form:"limit,default=20"`
}

func getPagination(c *gin.Context) (offset, limit int) {
	var p Pagination
	c.ShouldBindQuery(&p)
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 || p.Limit > 100 {
		p.Limit = 20
	}
	return (p.Page - 1) * p.Limit, p.Limit
}

func GetUserID(c *gin.Context) string {
	if userID, exists := c.Get("user_id"); exists {
		return userID.(string)
	}
	return ""
}

func ImportAppointments(c *gin.Context) {
	var req struct {
		BatchName string              `json:"batch_name" binding:"required"`
		Records   []map[string]string `json:"records" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	userID := GetUserID(c)
	result, err := reconcileService.ImportAppointments(req.BatchName, req.Records, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"batch_id":       result.BatchID,
		"total_records":  result.TotalRecords,
		"failed_records": result.FailedRecords,
	})
}

func ImportGateRecords(c *gin.Context) {
	var req struct {
		BatchName string              `json:"batch_name" binding:"required"`
		Records   []map[string]string `json:"records" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	userID := GetUserID(c)
	result, err := reconcileService.ImportGateRecords(req.BatchName, req.Records, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"batch_id":       result.BatchID,
		"total_records":  result.TotalRecords,
		"failed_records": result.FailedRecords,
	})
}

func ImportPlateImages(c *gin.Context) {
	var req struct {
		BatchName string              `json:"batch_name" binding:"required"`
		Records   []map[string]string `json:"records" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	userID := GetUserID(c)
	result, err := reconcileService.ImportPlateImages(req.BatchName, req.Records, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"batch_id":       result.BatchID,
		"total_records":  result.TotalRecords,
		"failed_records": result.FailedRecords,
	})
}

func ListAppointments(c *gin.Context) {
	batchID := c.Query("batch_id")
	offset, limit := getPagination(c)

	appts, total, err := repository.ListAppointments(batchID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  appts,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func GetAppointment(c *gin.Context) {
	id := c.Param("id")
	appt, err := repository.GetAppointment(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if appt == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "记录不存在"})
		return
	}
	c.JSON(http.StatusOK, appt)
}

func UpdateAppointment(c *gin.Context) {
	id := c.Param("id")
	appt, err := repository.GetAppointment(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if appt == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "记录不存在"})
		return
	}
	if appt.IsFrozen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "记录已冻结，无法修改"})
		return
	}

	var req struct {
		VisitorName    string `json:"visitor_name"`
		VisitorIDCard  string `json:"visitor_id_card"`
		VisitorPhone   string `json:"visitor_phone"`
		LicensePlate   string `json:"license_plate"`
		VisitDate      string `json:"visit_date"`
		VisitEndDate   string `json:"visit_end_date"`
		VisitReason    string `json:"visit_reason"`
		VisitorCompany string `json:"visitor_company"`
		HostName       string `json:"host_name"`
		HostDepartment string `json:"host_department"`
		AccessArea     string `json:"access_area"`
		Status         string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	if req.VisitorName != "" {
		appt.VisitorName = req.VisitorName
	}
	if req.VisitorIDCard != "" {
		appt.VisitorIDCard = req.VisitorIDCard
	}
	if req.VisitorPhone != "" {
		appt.VisitorPhone = req.VisitorPhone
	}
	if req.LicensePlate != "" {
		appt.LicensePlate = req.LicensePlate
	}
	if req.Status != "" {
		appt.Status = req.Status
	}

	if err := repository.UpdateAppointment(appt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

func ReviewAppointment(c *gin.Context) {
	id := c.Param("id")
	userID := GetUserID(c)

	if err := reconcileService.ReviewAppointment(id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "复核成功"})
}

func FreezeAppointment(c *gin.Context) {
	id := c.Param("id")
	userID := GetUserID(c)

	if err := repository.FreezeAppointment(id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "冻结成功"})
}

func ListGateRecords(c *gin.Context) {
	batchID := c.Query("batch_id")
	offset, limit := getPagination(c)

	records, total, err := repository.ListGateRecords(batchID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  records,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func GetGateRecord(c *gin.Context) {
	id := c.Param("id")
	record, err := repository.GetGateRecord(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if record == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "记录不存在"})
		return
	}
	c.JSON(http.StatusOK, record)
}

func ListPlateImages(c *gin.Context) {
	batchID := c.Query("batch_id")
	offset, limit := getPagination(c)

	images, total, err := repository.ListPlateImages(batchID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  images,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func ListBatches(c *gin.Context) {
	offset, limit := getPagination(c)

	batches, total, err := repository.ListBatches(offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  batches,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func GetBatch(c *gin.Context) {
	id := c.Param("id")
	batch, err := repository.GetBatch(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if batch == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "批次不存在"})
		return
	}
	c.JSON(http.StatusOK, batch)
}

func FreezeBatch(c *gin.Context) {
	id := c.Param("id")
	userID := GetUserID(c)

	if err := repository.FreezeBatch(id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "批次冻结成功"})
}

func RunReconciliation(c *gin.Context) {
	batchID := c.Query("batch_id")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少batch_id参数"})
		return
	}

	userID := GetUserID(c)
	result, err := reconcileService.RunReconciliation(batchID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func ExportReport(c *gin.Context) {
	resultID := c.Param("id")
	reportPath, err := reconcileService.ExportReport(resultID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"report_path": reportPath,
		"result_id":   resultID,
	})
}

func ListReconciliationResults(c *gin.Context) {
	batchID := c.Query("batch_id")
	offset, limit := getPagination(c)

	results, total, err := repository.ListReconciliationResults(batchID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  results,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func ListImportFailures(c *gin.Context) {
	batchID := c.Query("batch_id")
	offset, limit := getPagination(c)

	failures, total, err := repository.ListImportFailures(batchID, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  failures,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func ListAuditLogs(c *gin.Context) {
	offset, limit := getPagination(c)

	logs, total, err := repository.ListAuditLogs(offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  (offset / limit) + 1,
		"limit": limit,
	})
}

func ListUsers(c *gin.Context) {
	users, err := repository.ListUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func CreateUser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误"})
		return
	}

	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	user := &model.User{
		ID:       "u-" + strconv.FormatInt(time.Now().Unix(), 36),
		Username: req.Username,
		Password: hashed,
		Role:     model.Role(req.Role),
	}

	if err := repository.CreateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "用户创建成功", "user_id": user.ID})
}
