package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"device-borrow-system/internal/config"
	"device-borrow-system/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type API struct {
	userService    *service.UserService
	deviceService  *service.DeviceService
	borrowService  *service.BorrowService
	auditService   *service.AuditService
	exportService  *service.ExportService
	cfg            *config.Config
}

func RegisterRoutes(
	router *gin.Engine,
	userService *service.UserService,
	deviceService *service.DeviceService,
	borrowService *service.BorrowService,
	auditService *service.AuditService,
	exportService *service.ExportService,
	cfg *config.Config,
) {
	api := &API{
		userService:   userService,
		deviceService: deviceService,
		borrowService: borrowService,
		auditService:  auditService,
		exportService: exportService,
		cfg:          cfg,
	}

	router.GET("/health", api.HealthCheck)

	v1 := router.Group("/api/v1")

	v1.POST("/auth/login", api.Login)
	v1.POST("/auth/register", api.Register)

	auth := v1.Group("")
	auth.Use(AuthMiddleware(cfg))
	{
		auth.GET("/users/me", api.GetCurrentUser)
		auth.GET("/users", api.ListUsers)
		auth.GET("/users/:id", api.GetUser)
		auth.PUT("/users/:id", api.UpdateUser)

		auth.GET("/devices", api.ListDevices)
		auth.GET("/devices/:id", api.GetDevice)
		auth.POST("/devices", api.CreateDevice)
		auth.PUT("/devices/:id", api.UpdateDevice)
		auth.DELETE("/devices/:id", api.DeleteDevice)

		auth.GET("/borrows", api.ListBorrowRecords)
		auth.GET("/borrows/:id", api.GetBorrowRecord)
		auth.POST("/borrows", api.BorrowDevice)
		auth.POST("/borrows/:id/return", api.ReturnDevice)
		auth.GET("/borrows/user/:userId", api.GetUserBorrowHistory)

		auth.GET("/audit", api.ListAuditLogs)
		auth.GET("/audit/:resourceType/:resourceId", api.GetResourceHistory)
		auth.GET("/events/:aggregateType/:aggregateId", api.GetEventHistory)
		auth.POST("/events/replay/:aggregateType/:aggregateId", api.ReplayAggregate)
		auth.GET("/events/request/:requestId", api.GetEventsByRequest)

		auth.GET("/export/report", api.ExportReport)
	}
}

func (api *API) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"timestamp": time.Now().Unix(),
	})
}

func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := authHeader[len("Bearer "):]
		claims, err := validateToken(tokenString, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("username", claims["username"])
		c.Set("role", claims["role"])
		c.Next()
	}
}

func (api *API) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := api.userService.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func (api *API) Register(c *gin.Context) {
	var req struct {
		Username   string `json:"username" binding:"required"`
		Email      string `json:"email" binding:"required"`
		Password   string `json:"password" binding:"required"`
		FullName   string `json:"full_name" binding:"required"`
		Department string `json:"department"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := api.userService.Register(req.Username, req.Email, req.Password, req.FullName, req.Department)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user":    user,
	})
}

func (api *API) GetCurrentUser(c *gin.Context) {
	userID := c.GetString("user_id")
	id, _ := uuid.Parse(userID)

	user, err := api.userService.GetUser(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (api *API) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	users, total, err := api.userService.ListUsers(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

func (api *API) GetUser(c *gin.Context) {
	id := c.Param("id")
	userID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := api.userService.GetUser(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (api *API) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	userID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expectedVersion, _ := strconv.ParseInt(c.GetHeader("If-Match"), 10, 64)

	user, err := api.userService.UpdateUser(userID, updates, expectedVersion)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (api *API) ListDevices(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filters := make(map[string]interface{})
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if category := c.Query("category"); category != "" {
		filters["category"] = category
	}

	devices, total, err := api.deviceService.ListDevices(filters, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"devices": devices,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
	})
}

func (api *API) GetDevice(c *gin.Context) {
	id := c.Param("id")
	deviceID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid device ID"})
		return
	}

	device, err := api.deviceService.GetDevice(deviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Device not found"})
		return
	}

	c.JSON(http.StatusOK, device)
}

func (api *API) CreateDevice(c *gin.Context) {
	var req struct {
		DeviceCode  string `json:"device_code" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Category    string `json:"category" binding:"required"`
		Description string `json:"description"`
		Location    string `json:"location"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	createdBy, _ := uuid.Parse(userID)

	device, err := api.deviceService.CreateDevice(
		req.DeviceCode,
		req.Name,
		req.Category,
		req.Description,
		req.Location,
		createdBy,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, device)
}

func (api *API) UpdateDevice(c *gin.Context) {
	id := c.Param("id")
	deviceID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid device ID"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expectedVersion, _ := strconv.ParseInt(c.GetHeader("If-Match"), 10, 64)

	userID := c.GetString("user_id")
	updatedBy, _ := uuid.Parse(userID)

	device, err := api.deviceService.UpdateDevice(deviceID, updates, expectedVersion, updatedBy)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, device)
}

func (api *API) DeleteDevice(c *gin.Context) {
	id := c.Param("id")
	deviceID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid device ID"})
		return
	}

	userID := c.GetString("user_id")
	deletedBy, _ := uuid.Parse(userID)

	if err := api.deviceService.DeleteDevice(deviceID, deletedBy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device deleted successfully"})
}

func (api *API) ListBorrowRecords(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filters := make(map[string]interface{})
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}

	records, total, err := api.borrowService.ListBorrowRecords(filters, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"records": records,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
	})
}

func (api *API) GetBorrowRecord(c *gin.Context) {
	id := c.Param("id")
	recordID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid borrow record ID"})
		return
	}

	record, err := api.borrowService.GetBorrowRecord(recordID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Borrow record not found"})
		return
	}

	c.JSON(http.StatusOK, record)
}

func (api *API) BorrowDevice(c *gin.Context) {
	var req struct {
		DeviceID           string    `json:"device_id" binding:"required"`
		Purpose            string    `json:"purpose" binding:"required"`
		ExpectedReturnDate *time.Time `json:"expected_return_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deviceID, err := uuid.Parse(req.DeviceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid device ID"})
		return
	}

	userID := c.GetString("user_id")
	borrowerID, _ := uuid.Parse(userID)

	record, err := api.borrowService.BorrowDevice(
		deviceID,
		borrowerID,
		req.Purpose,
		req.ExpectedReturnDate,
		borrowerID,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, record)
}

func (api *API) ReturnDevice(c *gin.Context) {
	id := c.Param("id")
	recordID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid borrow record ID"})
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	returnedBy, _ := uuid.Parse(userID)

	record, err := api.borrowService.ReturnDevice(recordID, req.Notes, returnedBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, record)
}

func (api *API) GetUserBorrowHistory(c *gin.Context) {
	userIDParam := c.Param("userId")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	records, total, err := api.borrowService.GetUserBorrowHistory(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"records": records,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
	})
}

func (api *API) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filters := make(map[string]interface{})
	if userID := c.Query("user_id"); userID != "" {
		filters["user_id"] = userID
	}
	if resourceType := c.Query("resource_type"); resourceType != "" {
		filters["resource_type"] = resourceType
	}

	logs, total, err := api.auditService.ListAuditLogs(filters, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (api *API) GetResourceHistory(c *gin.Context) {
	resourceType := c.Param("resourceType")
	resourceIDParam := c.Param("resourceId")
	resourceID, err := uuid.Parse(resourceIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid resource ID"})
		return
	}

	logs, err := api.auditService.GetResourceHistory(resourceType, resourceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs": logs,
	})
}

func (api *API) GetEventHistory(c *gin.Context) {
	aggregateType := c.Param("aggregateType")
	aggregateIDParam := c.Param("aggregateId")
	aggregateID, err := uuid.Parse(aggregateIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid aggregate ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	events, err := api.auditService.GetEventHistory(aggregateType, aggregateID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"events": events,
	})
}

func (api *API) ReplayAggregate(c *gin.Context) {
	aggregateType := c.Param("aggregateType")
	aggregateIDParam := c.Param("aggregateId")
	aggregateID, err := uuid.Parse(aggregateIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid aggregate ID"})
		return
	}

	state, err := api.auditService.ReplayAggregate(aggregateType, aggregateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"state": state,
	})
}

func (api *API) GetEventsByRequest(c *gin.Context) {
	requestIDParam := c.Param("requestId")
	requestID, err := uuid.Parse(requestIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	events, err := api.auditService.GetEventsByRequestID(requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"events": events,
	})
}

func (api *API) ExportReport(c *gin.Context) {
	format := c.DefaultQuery("format", "excel")

	var startDate, endDate *time.Time
	if start := c.Query("start_date"); start != "" {
		if t, err := time.Parse("2006-01-02", start); err == nil {
			startDate = &t
		}
	}
	if end := c.Query("end_date"); end != "" {
		if t, err := time.Parse("2006-01-02", end); err == nil {
			endDate = &t
		}
	}

	status := c.Query("status")

	report, err := api.exportService.GenerateBorrowReport(startDate, endDate, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	switch format {
	case "excel":
		data, err := api.exportService.ExportToExcel(report)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", "attachment; filename=borrow_report.xlsx")
		c.Data(http.StatusOK, "application/octet-stream", data)

	case "markdown":
		md, err := api.exportService.ExportToMarkdown(report)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Content-Type", "text/markdown")
		c.Header("Content-Disposition", "attachment; filename=borrow_report.md")
		c.String(http.StatusOK, md)

	case "pdf":
		data, err := api.exportService.ExportToPDF(report)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", "attachment; filename=borrow_report.pdf")
		c.Data(http.StatusOK, "application/pdf", data)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid format. Use: excel, markdown, or pdf"})
	}
}

func validateToken(tokenString, secret string) (map[string]interface{}, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

var _ = json.Marshal
