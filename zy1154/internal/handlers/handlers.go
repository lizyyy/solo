package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"saga-demo/internal/models"
	"saga-demo/internal/services"
)

func SetupRoutes(
	router *mux.Router,
	orderService *services.OrderService,
	inventoryService *services.InventoryService,
	balanceService *services.BalanceService,
	couponService *services.CouponService,
	sagaService *services.SagaService,
	outboxService *services.OutboxService,
	compensationService *services.CompensationService,
	manualService *services.ManualHandlingService,
	failureService *services.FailureService,
	reportService *services.ReportService,
	seedService *services.SeedService,
) {
	api := router.PathPrefix("/api").Subrouter()

	api.HandleFunc("/orders", CreateOrderHandler(orderService, sagaService)).Methods("POST")
	api.HandleFunc("/orders", ListOrdersHandler(orderService)).Methods("GET")
	api.HandleFunc("/orders/{id}", GetOrderHandler(orderService)).Methods("GET")
	api.HandleFunc("/orders/{id}/status", UpdateOrderStatusHandler(orderService)).Methods("PUT")

	api.HandleFunc("/inventory", ListInventoryHandler(inventoryService)).Methods("GET")
	api.HandleFunc("/inventory/{product_id}", GetInventoryHandler(inventoryService)).Methods("GET")
	api.HandleFunc("/inventory/{product_id}/logs", GetInventoryLogsHandler(inventoryService)).Methods("GET")

	api.HandleFunc("/balances/{user_id}", GetBalanceHandler(balanceService)).Methods("GET")
	api.HandleFunc("/balances/{user_id}/logs", GetBalanceLogsHandler(balanceService)).Methods("GET")

	api.HandleFunc("/coupons", ListCouponsHandler(couponService)).Methods("GET")
	api.HandleFunc("/coupons/{id}", GetCouponHandler(couponService)).Methods("GET")

	api.HandleFunc("/sagas", ListSagasHandler(sagaService)).Methods("GET")
	api.HandleFunc("/sagas/{id}", GetSagaHandler(sagaService)).Methods("GET")
	api.HandleFunc("/sagas/{id}/steps", GetSagaStepsHandler(sagaService)).Methods("GET")
	api.HandleFunc("/sagas/{id}/retry", RetrySagaHandler(sagaService)).Methods("POST")

	api.HandleFunc("/outbox/events", ListOutboxEventsHandler(outboxService)).Methods("GET")
	api.HandleFunc("/outbox/events/pending", GetPendingEventsHandler(outboxService)).Methods("GET")

	api.HandleFunc("/compensations", ListCompensationsHandler(compensationService)).Methods("GET")
	api.HandleFunc("/compensations/{id}", GetCompensationHandler(compensationService)).Methods("GET")
	api.HandleFunc("/compensations/{id}/retry", RetryCompensationHandler(compensationService)).Methods("POST")

	api.HandleFunc("/manual-tasks", ListManualTasksHandler(manualService)).Methods("GET")
	api.HandleFunc("/manual-tasks/{id}", GetManualTaskHandler(manualService)).Methods("GET")
	api.HandleFunc("/manual-tasks/{id}/start", StartManualTaskHandler(manualService)).Methods("POST")
	api.HandleFunc("/manual-tasks/{id}/resolve", ResolveManualTaskHandler(manualService)).Methods("POST")
	api.HandleFunc("/manual-tasks/{id}/escalate", EscalateManualTaskHandler(manualService)).Methods("POST")

	api.HandleFunc("/failures", ListFailuresHandler(failureService)).Methods("GET")
	api.HandleFunc("/failures", RegisterFailureHandler(failureService)).Methods("POST")
	api.HandleFunc("/failures/{service}/{operation}", DisableFailureHandler(failureService)).Methods("DELETE")
	api.HandleFunc("/failures", DisableAllFailuresHandler(failureService)).Methods("DELETE")

	api.HandleFunc("/reports/consistency", GetConsistencyReportHandler(reportService)).Methods("GET")
	api.HandleFunc("/reports/consistency/export", ExportConsistencyReportHandler(reportService)).Methods("GET")

	api.HandleFunc("/seed/reset", ResetSeedHandler(seedService)).Methods("POST")
	api.HandleFunc("/seed/status", GetSeedStatusHandler(seedService)).Methods("GET")
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: true,
		Data:    data,
	})
}

func jsonError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.APIResponse{
		Success: false,
		Error:   message,
	})
}

func CreateOrderHandler(orderService *services.OrderService, sagaService *services.SagaService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.CreateOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if req.UserID == "" || req.ProductID == "" || req.Quantity <= 0 {
			jsonError(w, http.StatusBadRequest, "user_id, product_id and valid quantity are required")
			return
		}

		saga, err := sagaService.CreateOrderSaga(req.UserID, req.ProductID, req.Quantity, req.CouponID)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create order saga: %v", err))
			return
		}

		go func() {
			if err := sagaService.ExecuteSaga(saga.ID); err != nil {
				fmt.Printf("Saga execution failed: %v\n", err)
			}
		}()

		jsonResponse(w, http.StatusCreated, models.CreateOrderResponse{
			OrderID: saga.OrderID,
			SagaID:  saga.ID,
			Status:  saga.Status,
		})
	}
}

func ListOrdersHandler(orderService *services.OrderService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		orders, err := orderService.ListOrders(userID)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, orders)
	}
}

func GetOrderHandler(orderService *services.OrderService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		orderID := vars["id"]

		order, err := orderService.GetOrder(orderID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, order)
	}
}

func UpdateOrderStatusHandler(orderService *services.OrderService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		orderID := vars["id"]

		var req struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if err := orderService.UpdateOrderStatus(orderID, models.OrderStatus(req.Status)); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{"message": "Order status updated"})
	}
}

func ListInventoryHandler(inventoryService *services.InventoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		inventories, err := inventoryService.ListInventory()
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, inventories)
	}
}

func GetInventoryHandler(inventoryService *services.InventoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		productID := vars["product_id"]

		inventory, err := inventoryService.GetInventory(productID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, inventory)
	}
}

func GetInventoryLogsHandler(inventoryService *services.InventoryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		productID := vars["product_id"]
		orderID := r.URL.Query().Get("order_id")

		var logs []models.InventoryLog
		var err error

		if orderID != "" {
			logs, err = inventoryService.GetInventoryLogs(orderID)
		} else {
			logs, err = inventoryService.GetInventoryLogsByProduct(productID)
		}

		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, logs)
	}
}

func GetBalanceHandler(balanceService *services.BalanceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := vars["user_id"]

		balance, err := balanceService.GetBalance(userID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, balance)
	}
}

func GetBalanceLogsHandler(balanceService *services.BalanceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		userID := vars["user_id"]
		orderID := r.URL.Query().Get("order_id")

		var logs []models.BalanceLog
		var err error

		if orderID != "" {
			logs, err = balanceService.GetBalanceLogs(orderID)
		} else {
			logs, err = balanceService.GetBalanceLogsByUser(userID)
		}

		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, logs)
	}
}

func ListCouponsHandler(couponService *services.CouponService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		coupons, err := couponService.ListCoupons()
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, coupons)
	}
}

func GetCouponHandler(couponService *services.CouponService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		couponID := vars["id"]

		coupon, err := couponService.GetCoupon(couponID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, coupon)
	}
}

func ListSagasHandler(sagaService *services.SagaService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		sagas, err := sagaService.ListSagas(models.SagaStatus(status))
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, sagas)
	}
}

func GetSagaHandler(sagaService *services.SagaService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		sagaID := vars["id"]

		saga, err := sagaService.GetSaga(sagaID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, saga)
	}
}

func GetSagaStepsHandler(sagaService *services.SagaService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		sagaID := vars["id"]

		steps, err := sagaService.GetSagaSteps(sagaID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, steps)
	}
}

func RetrySagaHandler(sagaService *services.SagaService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		sagaID := vars["id"]

		saga, err := sagaService.GetSaga(sagaID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}

		if saga.Status != models.SagaStatusFailed && saga.Status != models.SagaStatusPending {
			jsonError(w, http.StatusBadRequest, "Saga is not in retryable state")
			return
		}

		go func() {
			if err := sagaService.ExecuteSaga(sagaID); err != nil {
				fmt.Printf("Saga retry failed: %v\n", err)
			}
		}()

		jsonResponse(w, http.StatusAccepted, map[string]string{
			"message": "Saga retry initiated",
			"saga_id": sagaID,
		})
	}
}

func ListOutboxEventsHandler(outboxService *services.OutboxService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		events, err := outboxService.GetAllEvents()
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, events)
	}
}

func GetPendingEventsHandler(outboxService *services.OutboxService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 100
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil {
				limit = n
			}
		}

		events, err := outboxService.GetPendingEvents(limit)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, events)
	}
}

func ListCompensationsHandler(compensationService *services.CompensationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sagaID := r.URL.Query().Get("saga_id")

		var tasks []models.CompensationTask
		var err error

		if sagaID != "" {
			tasks, err = compensationService.GetTasksBySaga(sagaID)
		} else {
			tasks, err = compensationService.GetAllTasks()
		}

		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, tasks)
	}
}

func GetCompensationHandler(compensationService *services.CompensationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		taskID := vars["id"]

		task, err := compensationService.GetTask(taskID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, task)
	}
}

func RetryCompensationHandler(compensationService *services.CompensationService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		taskID := vars["id"]

		task, err := compensationService.GetTask(taskID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}

		if err := compensationService.ExecuteTask(task); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message": "Compensation task executed",
			"task_id": taskID,
		})
	}
}

func ListManualTasksHandler(manualService *services.ManualHandlingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")

		var tasks []models.ManualHandling
		var err error

		if status != "" {
			tasks, err = manualService.GetTasksByStatus(models.ManualHandlingStatus(status))
		} else {
			tasks, err = manualService.GetAllTasks()
		}

		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, tasks)
	}
}

func GetManualTaskHandler(manualService *services.ManualHandlingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		taskID := vars["id"]

		task, err := manualService.GetTask(taskID)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, task)
	}
}

func StartManualTaskHandler(manualService *services.ManualHandlingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		taskID := vars["id"]

		var req struct {
			AssignedTo string `json:"assigned_to"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if err := manualService.StartProcessing(taskID, req.AssignedTo); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message":    "Manual task started",
			"task_id":    taskID,
			"assigned_to": req.AssignedTo,
		})
	}
}

func ResolveManualTaskHandler(manualService *services.ManualHandlingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		taskID := vars["id"]

		var req struct {
			Resolution string `json:"resolution"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if err := manualService.Resolve(taskID, req.Resolution); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message":    "Manual task resolved",
			"task_id":    taskID,
			"resolution": req.Resolution,
		})
	}
}

func EscalateManualTaskHandler(manualService *services.ManualHandlingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		taskID := vars["id"]

		if err := manualService.Escalate(taskID); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message": "Manual task escalated",
			"task_id": taskID,
		})
	}
}

func ListFailuresHandler(failureService *services.FailureService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		all := r.URL.Query().Get("all") == "true"

		var failures []models.FailureInjection
		var err error

		if all {
			failures, err = failureService.GetAllFailures()
		} else {
			failures, err = failureService.GetActiveFailures()
		}

		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, failures)
	}
}

func RegisterFailureHandler(failureService *services.FailureService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ServiceName string `json:"service_name"`
			Operation   string `json:"operation"`
			FailureType string `json:"failure_type"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if req.ServiceName == "" || req.Operation == "" || req.FailureType == "" {
			jsonError(w, http.StatusBadRequest, "service_name, operation, and failure_type are required")
			return
		}

		if err := failureService.RegisterFailure(req.ServiceName, req.Operation, services.FailureType(req.FailureType)); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusCreated, map[string]string{
			"message":      "Failure registered",
			"service_name": req.ServiceName,
			"operation":    req.Operation,
			"failure_type": req.FailureType,
		})
	}
}

func DisableFailureHandler(failureService *services.FailureService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		serviceName := vars["service"]
		operation := vars["operation"]

		if err := failureService.DisableFailure(serviceName, operation); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message":      "Failure disabled",
			"service_name": serviceName,
			"operation":    operation,
		})
	}
}

func DisableAllFailuresHandler(failureService *services.FailureService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := failureService.DisableAllFailures(); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message": "All failures disabled",
		})
	}
}

func GetConsistencyReportHandler(reportService *services.ReportService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		hours := 24
		if h := r.URL.Query().Get("hours"); h != "" {
			if n, err := strconv.Atoi(h); err == nil && n > 0 {
				hours = n
			}
		}

		report, err := reportService.GenerateConsistencyReport(time.Duration(hours) * time.Hour)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, report)
	}
}

func ExportConsistencyReportHandler(reportService *services.ReportService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		format := r.URL.Query().Get("format")
		if format == "" {
			format = "json"
		}

		hours := 24
		if h := r.URL.Query().Get("hours"); h != "" {
			if n, err := strconv.Atoi(h); err == nil && n > 0 {
				hours = n
			}
		}

		report, err := reportService.GenerateConsistencyReport(time.Duration(hours) * time.Hour)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		switch format {
		case "json":
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Content-Disposition", "attachment; filename=consistency_report.json")
			json.NewEncoder(w).Encode(report)

		case "csv":
			w.Header().Set("Content-Type", "text/csv")
			w.Header().Set("Content-Disposition", "attachment; filename=consistency_report.csv")
			writer := csv.NewWriter(w)
			defer writer.Flush()

			writer.Write([]string{"Report ID", report.ReportID})
			writer.Write([]string{"Generated At", report.GeneratedAt.Format(time.RFC3339)})
			writer.Write([]string{})
			writer.Write([]string{"Summary"})
			writer.Write([]string{"Total Orders", fmt.Sprintf("%d", report.Summary.TotalOrders)})
			writer.Write([]string{"Successful Orders", fmt.Sprintf("%d", report.Summary.SuccessfulOrders)})
			writer.Write([]string{"Failed Orders", fmt.Sprintf("%d", report.Summary.FailedOrders)})
			writer.Write([]string{"Compensated Orders", fmt.Sprintf("%d", report.Summary.CompensatedOrders)})
			writer.Write([]string{"Inconsistent Count", fmt.Sprintf("%d", report.Summary.InconsistentCount)})
			writer.Write([]string{"Pending Manual Tasks", fmt.Sprintf("%d", report.Summary.PendingManual)})
			writer.Write([]string{})

			if len(report.Inconsistents) > 0 {
				writer.Write([]string{"Inconsistent Items"})
				writer.Write([]string{"Order ID", "Resource Type", "Expected State", "Actual State", "Severity", "Description"})
				for _, item := range report.Inconsistents {
					writer.Write([]string{
						item.OrderID,
						item.ResourceType,
						item.ExpectedState,
						item.ActualState,
						item.Severity,
						item.Description,
					})
				}
			}

		case "markdown", "md":
			w.Header().Set("Content-Type", "text/markdown")
			w.Header().Set("Content-Disposition", "attachment; filename=consistency_report.md")
			md, err := reportService.ExportToMarkdown(report)
			if err != nil {
				jsonError(w, http.StatusInternalServerError, err.Error())
				return
			}
			w.Write([]byte(md))

		default:
			jsonError(w, http.StatusBadRequest, "Invalid format. Supported: json, csv, markdown")
		}
	}
}

func ResetSeedHandler(seedService *services.SeedService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := seedService.Reset(); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}

		jsonResponse(w, http.StatusOK, map[string]string{
			"message": "Seed data reset successfully",
		})
	}
}

func GetSeedStatusHandler(seedService *services.SeedService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := seedService.GetStatus()
		jsonResponse(w, http.StatusOK, status)
	}
}
