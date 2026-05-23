package api

import (
	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	r.POST("/api/auth/login", Login)

	api := r.Group("/api")
	api.Use(AuthMiddleware())

	appointments := api.Group("/appointments")
	{
		appointments.GET("", PermissionMiddleware("appointment", "read"), ListAppointments)
		appointments.GET("/:id", PermissionMiddleware("appointment", "read"), GetAppointment)
		appointments.PUT("/:id", PermissionMiddleware("appointment", "update"), AuditMiddleware("update", "appointment"), UpdateAppointment)
		appointments.POST("/:id/review", PermissionMiddleware("appointment", "update"), AuditMiddleware("review", "appointment"), ReviewAppointment)
		appointments.POST("/:id/freeze", PermissionMiddleware("appointment", "update"), AuditMiddleware("freeze", "appointment"), FreezeAppointment)
	}

	gateRecords := api.Group("/gate-records")
	{
		gateRecords.GET("", PermissionMiddleware("gate_record", "read"), ListGateRecords)
		gateRecords.GET("/:id", PermissionMiddleware("gate_record", "read"), GetGateRecord)
	}

	plateImages := api.Group("/plate-images")
	{
		plateImages.GET("", PermissionMiddleware("plate_image", "read"), ListPlateImages)
	}

	batches := api.Group("/batches")
	{
		batches.GET("", PermissionMiddleware("batch", "read"), ListBatches)
		batches.GET("/:id", PermissionMiddleware("batch", "read"), GetBatch)
		batches.POST("/:id/freeze", PermissionMiddleware("batch", "update"), AuditMiddleware("freeze", "batch"), FreezeBatch)
	}

	importGroup := api.Group("/import")
	{
		importGroup.POST("/appointments", PermissionMiddleware("appointment", "create"), AuditMiddleware("import", "appointment"), ImportAppointments)
		importGroup.POST("/gate-records", PermissionMiddleware("gate_record", "create"), AuditMiddleware("import", "gate_record"), ImportGateRecords)
		importGroup.POST("/plate-images", PermissionMiddleware("plate_image", "create"), AuditMiddleware("import", "plate_image"), ImportPlateImages)
	}

	importGroup.GET("/failures", PermissionMiddleware("appointment", "read"), ListImportFailures)

	reconcile := api.Group("/reconciliation")
	{
		reconcile.POST("/run", PermissionMiddleware("reconciliation", "create"), AuditMiddleware("run", "reconciliation"), RunReconciliation)
		reconcile.GET("/results", PermissionMiddleware("reconciliation", "read"), ListReconciliationResults)
		reconcile.GET("/export/:id", PermissionMiddleware("reconciliation", "read"), ExportReport)
	}

	audit := api.Group("/audit")
	{
		audit.GET("/logs", PermissionMiddleware("audit", "read"), ListAuditLogs)
	}

	users := api.Group("/users")
	{
		users.GET("", PermissionMiddleware("user", "read"), ListUsers)
		users.POST("", PermissionMiddleware("user", "create"), CreateUser)
	}

	return r
}
