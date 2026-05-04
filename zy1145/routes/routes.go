package routes

import (
	"btc-recharge-service/config"
	"btc-recharge-service/handlers"
	"btc-recharge-service/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	addrSvc := services.NewAddressService(db, cfg)
	riskSvc := services.NewRiskControlService(db, cfg)
	txSvc := services.NewTransactionService(db, cfg, addrSvc, riskSvc)
	utxoSvc := services.NewUTXOService(db, cfg, riskSvc)
	collectionSvc := services.NewCollectionService(db, cfg, utxoSvc, riskSvc)
	auditSvc := services.NewAuditService(db, cfg, utxoSvc)

	addrHandler := handlers.NewAddressHandler(addrSvc)
	txHandler := handlers.NewTransactionHandler(txSvc, riskSvc)
	utxoHandler := handlers.NewUTXOHandler(utxoSvc)
	collectionHandler := handlers.NewCollectionHandler(collectionSvc)
	auditHandler := handlers.NewAuditHandler(auditSvc)
	healthHandler := handlers.NewHealthHandler()

	api := r.Group("/api/v1")
	{
		health := api.Group("/health")
		{
			health.GET("", healthHandler.HealthCheck)
			health.GET("/ready", healthHandler.ReadinessCheck)
		}

		addresses := api.Group("/addresses")
		{
			addresses.POST("", addrHandler.CreateAddress)
			addresses.GET("", addrHandler.GetAllAddresses)
			addresses.GET("/:id", addrHandler.GetAddressByID)
			addresses.GET("/user/:user_id", addrHandler.GetAddressesByUserID)
		}

		transactions := api.Group("/transactions")
		{
			transactions.POST("/import-block", txHandler.ImportBlock)
			transactions.POST("/import-mempool", txHandler.ImportMempool)
			transactions.GET("/:tx_id", txHandler.GetTransaction)
			transactions.GET("/address/:address", txHandler.GetTransactionsByAddress)
			transactions.GET("/:tx_id/status", txHandler.CalculateDepositStatus)
			transactions.POST("/:tx_id/suspicious", txHandler.MarkAsSuspicious)
		}

		utxo := api.Group("/utxo")
		{
			utxo.GET("/balance/:address", utxoHandler.GetAddressBalance)
			utxo.GET("/user/:user_id/balances", utxoHandler.GetUserBalances)
			utxo.GET("/address/:address", utxoHandler.GetUTXOsByAddress)
			utxo.GET("/spendable/:address", utxoHandler.GetSpendableUTXOs)
			utxo.GET("/spendable", utxoHandler.GetAllSpendableUTXOs)
			utxo.GET("/suspicious", utxoHandler.GetSuspiciousUTXOs)
			utxo.GET("/summary", utxoHandler.GetUTXOSummary)
		}

		collection := api.Group("/collection")
		{
			collection.POST("", collectionHandler.CreateCollectionPlan)
			collection.GET("", collectionHandler.GetAllPlans)
			collection.GET("/:plan_id", collectionHandler.GetPlan)
			collection.POST("/:plan_id/approve", collectionHandler.ApprovePlan)
			collection.POST("/:plan_id/reject", collectionHandler.RejectPlan)
			collection.POST("/:plan_id/execute", collectionHandler.ExecutePlan)
		}

		audit := api.Group("/audit")
		{
			audit.GET("/report", auditHandler.GenerateReport)
			audit.GET("/report/csv", auditHandler.ExportReportCSV)
			audit.GET("/logs", auditHandler.GetAuditLogs)
		}

		risk := api.Group("/risk")
		{
			risk.GET("/config", txHandler.GetRiskConfig)
			risk.GET("/estimate-fee", txHandler.EstimateFee)
		}
	}

	return r
}
