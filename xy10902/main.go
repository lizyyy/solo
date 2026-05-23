package main

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type Vehicle struct {
	ID          int       `json:"id"`
	PlateNumber string    `json:"plate_number"`
	OwnerName   string    `json:"owner_name"`
	OwnerPhone  string    `json:"owner_phone"`
	Balance     float64   `json:"balance"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type MonthlyPlan struct {
	ID           int       `json:"id"`
	PlanName     string    `json:"plan_name"`
	Price        float64   `json:"price"`
	DurationDays int       `json:"duration_days"`
	Description  string    `json:"description"`
	IsActive     int       `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

type VehicleSubscription struct {
	ID          int       `json:"id"`
	VehicleID   int       `json:"vehicle_id"`
	PlanID      int       `json:"plan_id"`
	StartDate   string    `json:"start_date"`
	EndDate     string    `json:"end_date"`
	TotalAmount float64   `json:"total_amount"`
	PaidAmount  float64   `json:"paid_amount"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type GateEvent struct {
	ID           int       `json:"id"`
	EventID      string    `json:"event_id"`
	PlateNumber  string    `json:"plate_number"`
	EventType    string    `json:"event_type"`
	EventTime    string    `json:"event_time"`
	GateID       string    `json:"gate_id"`
	Direction    string    `json:"direction"`
	Processed    int       `json:"processed"`
	Deduplicated int       `json:"deduplicated"`
	CreatedAt    time.Time `json:"created_at"`
}

type DeductionRecord struct {
	ID             int       `json:"id"`
	DeductionNo    string    `json:"deduction_no"`
	PlateNumber    string    `json:"plate_number"`
	VehicleID      int       `json:"vehicle_id"`
	SubscriptionID int       `json:"subscription_id"`
	EventID        string    `json:"event_id"`
	Amount         float64   `json:"amount"`
	DeductionType  string    `json:"deduction_type"`
	DeductionTime  time.Time `json:"deduction_time"`
	BalanceBefore  float64   `json:"balance_before"`
	BalanceAfter   float64   `json:"balance_after"`
	Status         string    `json:"status"`
	Remark         string    `json:"remark"`
	CreatedAt      time.Time `json:"created_at"`
}

type SupplementaryDeduction struct {
	ID              int       `json:"id"`
	SupplementaryNo string    `json:"supplementary_no"`
	PlateNumber     string    `json:"plate_number"`
	OriginalEventID string    `json:"original_event_id"`
	Amount          float64   `json:"amount"`
	Reason          string    `json:"reason"`
	Status          string    `json:"status"`
	Applicant       string    `json:"applicant"`
	Reviewer        string    `json:"reviewer"`
	ReviewRemark    string    `json:"review_remark"`
	CreatedAt       time.Time `json:"created_at"`
	ReviewedAt      time.Time `json:"reviewed_at"`
	DeductedAt      time.Time `json:"deducted_at"`
}

type ReconciliationSummary struct {
	ID                      int       `json:"id"`
	SummaryDate             string    `json:"summary_date"`
	TotalRenewals           int       `json:"total_renewals"`
	RenewalAmount           float64   `json:"renewal_amount"`
	TotalTemporaryDeductions int      `json:"total_temporary_deductions"`
	TemporaryAmount         float64   `json:"temporary_amount"`
	TotalGateEvents         int       `json:"total_gate_events"`
	TotalSupplementary      int       `json:"total_supplementary"`
	SupplementaryAmount     float64   `json:"supplementary_amount"`
	DiscrepancyAmount       float64   `json:"discrepancy_amount"`
	Status                  string    `json:"status"`
	GeneratedAt             time.Time `json:"generated_at"`
}

type ExceptionLog struct {
	ID               int       `json:"id"`
	ExceptionType    string    `json:"exception_type"`
	RawInput         string    `json:"raw_input"`
	ErrorMessage     string    `json:"error_message"`
	ProcessingResult string    `json:"processing_result"`
	APIPath          string    `json:"api_path"`
	CreatedAt        time.Time `json:"created_at"`
}

func initDB() {
	var err error
	db, err = sql.Open("sqlite3", "./data/parking-go.db")
	if err != nil {
		log.Fatal(err)
	}

	db.SetMaxOpenConns(1)

	createTables()
	log.Println("Go版本数据库初始化完成")
}

func createTables() {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS vehicles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plate_number TEXT UNIQUE NOT NULL,
			owner_name TEXT,
			owner_phone TEXT,
			balance DECIMAL(10,2) DEFAULT 0.00,
			status TEXT DEFAULT 'active',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS monthly_plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plan_name TEXT NOT NULL,
			price DECIMAL(10,2) NOT NULL,
			duration_days INTEGER NOT NULL,
			description TEXT,
			is_active INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS vehicle_subscriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			vehicle_id INTEGER NOT NULL,
			plan_id INTEGER NOT NULL,
			start_date DATETIME NOT NULL,
			end_date DATETIME NOT NULL,
			total_amount DECIMAL(10,2) NOT NULL,
			paid_amount DECIMAL(10,2) DEFAULT 0.00,
			status TEXT DEFAULT 'active',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS gate_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id TEXT UNIQUE NOT NULL,
			plate_number TEXT NOT NULL,
			event_type TEXT NOT NULL,
			event_time DATETIME NOT NULL,
			gate_id TEXT,
			direction TEXT,
			processed INTEGER DEFAULT 0,
			deduplicated INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS deduction_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			deduction_no TEXT UNIQUE NOT NULL,
			plate_number TEXT NOT NULL,
			vehicle_id INTEGER,
			subscription_id INTEGER,
			event_id TEXT,
			amount DECIMAL(10,2) NOT NULL,
			deduction_type TEXT NOT NULL,
			deduction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
			balance_before DECIMAL(10,2),
			balance_after DECIMAL(10,2),
			status TEXT DEFAULT 'success',
			remark TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS supplementary_deductions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			supplementary_no TEXT UNIQUE NOT NULL,
			plate_number TEXT NOT NULL,
			original_event_id TEXT,
			amount DECIMAL(10,2) NOT NULL,
			reason TEXT NOT NULL,
			status TEXT DEFAULT 'pending',
			applicant TEXT,
			reviewer TEXT,
			review_remark TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			reviewed_at DATETIME,
			deducted_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS reconciliation_summaries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			summary_date DATE UNIQUE NOT NULL,
			total_renewals INTEGER DEFAULT 0,
			renewal_amount DECIMAL(10,2) DEFAULT 0.00,
			total_temporary_deductions INTEGER DEFAULT 0,
			temporary_amount DECIMAL(10,2) DEFAULT 0.00,
			total_gate_events INTEGER DEFAULT 0,
			total_supplementary INTEGER DEFAULT 0,
			supplementary_amount DECIMAL(10,2) DEFAULT 0.00,
			discrepancy_amount DECIMAL(10,2) DEFAULT 0.00,
			status TEXT DEFAULT 'pending',
			generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS exception_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			exception_type TEXT NOT NULL,
			raw_input TEXT,
			error_message TEXT,
			processing_result TEXT,
			api_path TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, stmt := range statements {
		_, err := db.Exec(stmt)
		if err != nil {
			log.Printf("表创建警告: %v", err)
		}
	}
}

func logException(exceptionType, rawInput, errorMsg, result, apiPath string) {
	db.Exec(`INSERT INTO exception_logs (exception_type, raw_input, error_message, processing_result, api_path) VALUES (?, ?, ?, ?, ?)`,
		exceptionType, rawInput, errorMsg, result, apiPath)
}

func getRawBody(c *gin.Context) string {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return ""
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
	return string(body)
}

func generateDeductionNo() string {
	return "DK" + time.Now().Format("20060102150405") + fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
}

func generateSupplementaryNo() string {
	return "BK" + time.Now().Format("20060102150405") + fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
}

func main() {
	initDB()
	defer db.Close()

	r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"success":   true,
				"message":   "停车场月租扣费GO API服务运行正常",
				"timestamp": time.Now().Format(time.RFC3339),
			})
		})

		setupVehicleRoutes(api)
		setupPlanRoutes(api)
		setupGateEventRoutes(api)
		setupDeductionRoutes(api)
		setupSupplementaryRoutes(api)
		setupReconciliationRoutes(api)
		setupExceptionRoutes(api)
	}

	log.Println("Go REST API 服务启动在 :8080")
	log.Println("健康检查: GET http://localhost:8080/api/v1/health")
	r.Run(":8080")
}

func setupVehicleRoutes(api *gin.RouterGroup) {
	vehicles := api.Group("/vehicles")
	{
		vehicles.POST("", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var v Vehicle
			if err := c.ShouldBindJSON(&v); err != nil {
				logException("param_validation_error", rawBody, err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if v.PlateNumber == "" {
				logException("param_validation_error", rawBody, "车牌号不能为空", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "车牌号不能为空"})
				return
			}

			result, err := db.Exec(`INSERT INTO vehicles (plate_number, owner_name, owner_phone, balance) VALUES (?, ?, ?, 0)`,
				v.PlateNumber, v.OwnerName, v.OwnerPhone)
			if err != nil {
				logException("create_vehicle_error", rawBody, err.Error(), "返回500", c.Request.URL.Path)
				c.JSON(http.StatusInternalServerError, Response{Success: false, Error: "车辆已存在或创建失败"})
				return
			}

			id, _ := result.LastInsertId()
			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"id": id}})
		})

		vehicles.GET("/:plate", func(c *gin.Context) {
			plate := c.Param("plate")
			var v Vehicle
			err := db.QueryRow(`SELECT id, plate_number, owner_name, owner_phone, balance, status FROM vehicles WHERE plate_number = ?`, plate).
				Scan(&v.ID, &v.PlateNumber, &v.OwnerName, &v.OwnerPhone, &v.Balance, &v.Status)
			
			if err == sql.ErrNoRows {
				logException("vehicle_not_found", plate, "车辆不存在", "返回404", c.Request.URL.Path)
				c.JSON(http.StatusNotFound, Response{Success: false, Error: "车辆不存在"})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, Response{Success: false, Error: err.Error()})
				return
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: v})
		})

		vehicles.POST("/recharge", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var req struct {
				PlateNumber string  `json:"plate_number"`
				Amount      float64 `json:"amount"`
			}
			if err := c.ShouldBindJSON(&req); err != nil || req.Amount <= 0 {
				logException("param_validation_error", rawBody, "参数错误或金额无效", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			var v Vehicle
			err := db.QueryRow(`SELECT id, balance FROM vehicles WHERE plate_number = ?`, req.PlateNumber).Scan(&v.ID, &v.Balance)
			
			if err == sql.ErrNoRows {
				db.Exec(`INSERT INTO vehicles (plate_number, balance) VALUES (?, ?)`, req.PlateNumber, req.Amount)
			} else {
				newBalance := v.Balance + req.Amount
				db.Exec(`UPDATE vehicles SET balance = ? WHERE id = ?`, newBalance, v.ID)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"recharged": req.Amount, "plate_number": req.PlateNumber}})
		})

		vehicles.POST("/subscribe", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var req struct {
				PlateNumber string `json:"plate_number"`
				PlanID      int    `json:"plan_id"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				logException("param_validation_error", rawBody, err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if req.PlateNumber == "" || req.PlanID == 0 {
				logException("param_validation_error", rawBody, "缺少plate_number或plan_id", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			var v Vehicle
			err := db.QueryRow(`SELECT id, balance FROM vehicles WHERE plate_number = ?`, req.PlateNumber).Scan(&v.ID, &v.Balance)
			if err == sql.ErrNoRows {
				logException("subscribe_vehicle_not_found", rawBody, "车辆不存在", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "车辆不存在"})
				return
			}

			var plan MonthlyPlan
			err = db.QueryRow(`SELECT id, plan_name, price, duration_days FROM monthly_plans WHERE id = ? AND is_active = 1`, req.PlanID).
				Scan(&plan.ID, &plan.PlanName, &plan.Price, &plan.DurationDays)
			if err == sql.ErrNoRows {
				logException("subscribe_plan_invalid", rawBody, "套餐不存在或已停用", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "套餐不存在或已停用"})
				return
			}

			if v.Balance < plan.Price {
				logException("subscribe_balance_insufficient", rawBody, fmt.Sprintf("余额不足: 当前%.2f元, 需%.2f元", v.Balance, plan.Price), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "账户余额不足，请先充值"})
				return
			}

			var existingSub VehicleSubscription
			var startDate, endDate time.Time
			err = db.QueryRow(`SELECT end_date FROM vehicle_subscriptions WHERE vehicle_id = ? AND status = 'active' AND end_date >= CURRENT_TIMESTAMP ORDER BY end_date DESC LIMIT 1`, v.ID).Scan(&existingSub.EndDate)
			if err == nil {
				startDate, _ = time.Parse("2006-01-02 15:04:05", existingSub.EndDate)
			} else {
				startDate = time.Now()
			}
			endDate = startDate.AddDate(0, 0, plan.DurationDays)

			newBalance := v.Balance - plan.Price
			tx, _ := db.Begin()
			tx.Exec(`UPDATE vehicles SET balance = ? WHERE id = ?`, newBalance, v.ID)
			
			subResult, _ := tx.Exec(`INSERT INTO vehicle_subscriptions (vehicle_id, plan_id, start_date, end_date, total_amount, paid_amount) VALUES (?, ?, ?, ?, ?, ?)`,
				v.ID, plan.ID, startDate.Format("2006-01-02 15:04:05"), endDate.Format("2006-01-02 15:04:05"), plan.Price, plan.Price)
			subID, _ := subResult.LastInsertId()

			deductionNo := generateDeductionNo()
			tx.Exec(`INSERT INTO deduction_records (deduction_no, plate_number, vehicle_id, subscription_id, amount, deduction_type, balance_before, balance_after, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				deductionNo, req.PlateNumber, v.ID, subID, plan.Price, "monthly_renewal", v.Balance, newBalance, "套餐续费: "+plan.PlanName)
			tx.Commit()

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{
				"subscription_id": subID,
				"start_date":      startDate.Format("2006-01-02"),
				"end_date":        endDate.Format("2006-01-02"),
				"amount":          plan.Price,
				"balance_after":   newBalance,
			}})
		})

		vehicles.GET("/:plate/subscriptions", func(c *gin.Context) {
			plate := c.Param("plate")
			var v Vehicle
			db.QueryRow(`SELECT id FROM vehicles WHERE plate_number = ?`, plate).Scan(&v.ID)
			if v.ID == 0 {
				c.JSON(http.StatusNotFound, Response{Success: false, Error: "车辆不存在"})
				return
			}

			rows, _ := db.Query(`SELECT vs.id, vs.start_date, vs.end_date, vs.total_amount, vs.status, mp.plan_name FROM vehicle_subscriptions vs JOIN monthly_plans mp ON vs.plan_id = mp.id WHERE vs.vehicle_id = ? ORDER BY vs.created_at DESC`, v.ID)
			defer rows.Close()

			var subs []gin.H
			for rows.Next() {
				var sub VehicleSubscription
				var planName string
				rows.Scan(&sub.ID, &sub.StartDate, &sub.EndDate, &sub.TotalAmount, &sub.Status, &planName)
				subs = append(subs, gin.H{"id": sub.ID, "plan_name": planName, "start_date": sub.StartDate, "end_date": sub.EndDate, "total_amount": sub.TotalAmount, "status": sub.Status})
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: subs})
		})
	}
}

func setupPlanRoutes(api *gin.RouterGroup) {
	plans := api.Group("/plans")
	{
		plans.POST("", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var p MonthlyPlan
			if err := c.ShouldBindJSON(&p); err != nil {
				logException("param_validation_error", rawBody, err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if p.PlanName == "" || p.Price <= 0 || p.DurationDays <= 0 {
				logException("param_validation_error", rawBody, "缺少必要参数或参数无效", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少必要参数"})
				return
			}

			result, _ := db.Exec(`INSERT INTO monthly_plans (plan_name, price, duration_days, description) VALUES (?, ?, ?, ?)`,
				p.PlanName, p.Price, p.DurationDays, p.Description)
			id, _ := result.LastInsertId()

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"plan_id": id}})
		})

		plans.GET("", func(c *gin.Context) {
			rows, _ := db.Query(`SELECT id, plan_name, price, duration_days, description FROM monthly_plans WHERE is_active = 1 ORDER BY price`)
			defer rows.Close()

			var plans []MonthlyPlan
			for rows.Next() {
				var p MonthlyPlan
				rows.Scan(&p.ID, &p.PlanName, &p.Price, &p.DurationDays, &p.Description)
				plans = append(plans, p)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: plans})
		})
	}
}

func setupGateEventRoutes(api *gin.RouterGroup) {
	events := api.Group("/gate-events")
	{
		events.POST("", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var e GateEvent
			if err := c.ShouldBindJSON(&e); err != nil {
				logException("param_validation_error", rawBody, err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if e.EventID == "" || e.PlateNumber == "" {
				logException("param_validation_error", rawBody, "缺少event_id或plate_number", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少必要参数"})
				return
			}

			var count int
			db.QueryRow(`SELECT COUNT(*) FROM gate_events WHERE event_id = ?`, e.EventID).Scan(&count)
			if count > 0 {
				logException("gate_event_duplicate", rawBody, "事件ID已存在，重复上报", "返回已处理状态", c.Request.URL.Path)
				c.JSON(http.StatusOK, gin.H{
					"success":   true,
					"duplicate": true,
					"message":   "事件已处理",
					"event_id":  e.EventID,
				})
				return
			}

			var dupCount int
			db.QueryRow(`SELECT COUNT(*) FROM gate_events WHERE plate_number = ? AND ABS(strftime('%s', event_time) - strftime('%s', ?)) < 300 AND deduplicated = 0`,
				e.PlateNumber, e.EventTime).Scan(&dupCount)
			if dupCount > 0 {
				db.Exec(`INSERT INTO gate_events (event_id, plate_number, event_type, event_time, gate_id, direction, deduplicated) VALUES (?, ?, ?, ?, ?, ?, 1)`,
					e.EventID, e.PlateNumber, e.EventType, e.EventTime, e.GateID, e.Direction)
				logException("gate_event_deduplicated", rawBody, "5分钟内同车辆重复事件，已去重", "标记去重，不扣费", c.Request.URL.Path)
				c.JSON(http.StatusOK, gin.H{
					"success":      true,
					"deduplicated": true,
					"message":      "5分钟内重复事件，已去重",
					"event_id":     e.EventID,
				})
				return
			}

			db.Exec(`INSERT INTO gate_events (event_id, plate_number, event_type, event_time, gate_id, direction) VALUES (?, ?, ?, ?, ?, ?)`,
				e.EventID, e.PlateNumber, e.EventType, e.EventTime, e.GateID, e.Direction)

			var v Vehicle
			var deductionResult gin.H
			err := db.QueryRow(`SELECT id, balance FROM vehicles WHERE plate_number = ?`, e.PlateNumber).Scan(&v.ID, &v.Balance)

			if err == nil {
				var sub VehicleSubscription
				err = db.QueryRow(`SELECT id, end_date FROM vehicle_subscriptions WHERE vehicle_id = ? AND status = 'active' AND end_date >= CURRENT_TIMESTAMP ORDER BY end_date DESC LIMIT 1`, v.ID).Scan(&sub.ID, &sub.EndDate)
				
				if err == nil {
					db.Exec(`UPDATE gate_events SET processed = 1 WHERE event_id = ?`, e.EventID)
					deductionResult = gin.H{
						"type":            "monthly_pass",
						"message":         "月卡车免费通行",
						"subscription_id": sub.ID,
					}
				} else {
					tempFee := 10.0
					if v.Balance >= tempFee {
						balanceAfter := v.Balance - tempFee
						deductionNo := generateDeductionNo()
						tx, _ := db.Begin()
						tx.Exec(`UPDATE vehicles SET balance = ? WHERE id = ?`, balanceAfter, v.ID)
						tx.Exec(`INSERT INTO deduction_records (deduction_no, plate_number, vehicle_id, event_id, amount, deduction_type, balance_before, balance_after, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
							deductionNo, e.PlateNumber, v.ID, e.EventID, tempFee, "temporary", v.Balance, balanceAfter, "临停扣费")
						tx.Exec(`UPDATE gate_events SET processed = 1 WHERE event_id = ?`, e.EventID)
						tx.Commit()
						deductionResult = gin.H{
							"type":          "temporary",
							"amount":        tempFee,
							"balance_after": balanceAfter,
						}
					} else {
						logException("balance_insufficient", rawBody, fmt.Sprintf("余额不足: 当前%.2f元, 需%.2f元", v.Balance, tempFee), "返回余额不足", c.Request.URL.Path)
						deductionResult = gin.H{
							"type":            "balance_insufficient",
							"message":         "余额不足，请充值",
							"required_amount": tempFee,
							"current_balance": v.Balance,
						}
					}
				}
			} else {
				logException("unregistered_vehicle", rawBody, "车辆未注册，无账户信息", "返回未注册，需现场缴费", c.Request.URL.Path)
				deductionResult = gin.H{
					"type":    "unregistered",
					"message": "未注册车辆",
					"action":  "现场缴费",
				}
			}

			c.JSON(http.StatusOK, gin.H{
				"success":      true,
				"event_id":     e.EventID,
				"plate_number": e.PlateNumber,
				"event_time":   e.EventTime,
				"deduction":    deductionResult,
			})
		})

		events.GET("/plate/:plate", func(c *gin.Context) {
			plate := c.Param("plate")
			rows, _ := db.Query(`SELECT event_id, plate_number, event_type, event_time, processed, deduplicated FROM gate_events WHERE plate_number = ? ORDER BY event_time DESC LIMIT 20`, plate)
			defer rows.Close()

			var events []GateEvent
			for rows.Next() {
				var e GateEvent
				rows.Scan(&e.EventID, &e.PlateNumber, &e.EventType, &e.EventTime, &e.Processed, &e.Deduplicated)
				events = append(events, e)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: events})
		})
	}
}

func setupDeductionRoutes(api *gin.RouterGroup) {
	deductions := api.Group("/deductions")
	{
		deductions.GET("/plate/:plate", func(c *gin.Context) {
			plate := c.Param("plate")
			rows, _ := db.Query(`SELECT deduction_no, plate_number, amount, deduction_type, deduction_time, status, remark FROM deduction_records WHERE plate_number = ? ORDER BY deduction_time DESC LIMIT 20`, plate)
			defer rows.Close()

			var records []gin.H
			for rows.Next() {
				var d DeductionRecord
				rows.Scan(&d.DeductionNo, &d.PlateNumber, &d.Amount, &d.DeductionType, &d.DeductionTime, &d.Status, &d.Remark)
				records = append(records, gin.H{
					"deduction_no":   d.DeductionNo,
					"plate_number":   d.PlateNumber,
					"amount":         d.Amount,
					"deduction_type": d.DeductionType,
					"deduction_time": d.DeductionTime,
					"status":         d.Status,
					"remark":         d.Remark,
				})
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: records})
		})

		deductions.GET("/:no", func(c *gin.Context) {
			no := c.Param("no")
			var d DeductionRecord
			err := db.QueryRow(`SELECT deduction_no, plate_number, amount, deduction_type, deduction_time, balance_before, balance_after, status, remark FROM deduction_records WHERE deduction_no = ?`, no).
				Scan(&d.DeductionNo, &d.PlateNumber, &d.Amount, &d.DeductionType, &d.DeductionTime, &d.BalanceBefore, &d.BalanceAfter, &d.Status, &d.Remark)
			
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, Response{Success: false, Error: "扣费记录不存在"})
				return
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: d})
		})
	}
}

func setupSupplementaryRoutes(api *gin.RouterGroup) {
	supp := api.Group("/supplementary")
	{
		supp.POST("", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var s SupplementaryDeduction
			if err := c.ShouldBindJSON(&s); err != nil {
				logException("param_validation_error", rawBody, err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if s.PlateNumber == "" || s.Amount <= 0 || s.Reason == "" {
				logException("param_validation_error", rawBody, "缺少必要参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少必要参数"})
				return
			}

			suppNo := generateSupplementaryNo()
			db.Exec(`INSERT INTO supplementary_deductions (supplementary_no, plate_number, original_event_id, amount, reason, applicant, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
				suppNo, s.PlateNumber, s.OriginalEventID, s.Amount, s.Reason, s.Applicant)

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"supplementary_no": suppNo, "status": "pending"}})
		})

		supp.GET("/status/:status", func(c *gin.Context) {
			status := c.Param("status")
			rows, _ := db.Query(`SELECT supplementary_no, plate_number, amount, reason, status, applicant FROM supplementary_deductions WHERE status = ? ORDER BY created_at DESC`, status)
			defer rows.Close()

			var list []gin.H
			for rows.Next() {
				var s SupplementaryDeduction
				rows.Scan(&s.SupplementaryNo, &s.PlateNumber, &s.Amount, &s.Reason, &s.Status, &s.Applicant)
				list = append(list, gin.H{
					"supplementary_no": s.SupplementaryNo,
					"plate_number":     s.PlateNumber,
					"amount":           s.Amount,
					"reason":           s.Reason,
					"status":           s.Status,
					"applicant":        s.Applicant,
				})
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: list})
		})

		supp.GET("/plate/:plate", func(c *gin.Context) {
			plate := c.Param("plate")
			rows, _ := db.Query(`SELECT supplementary_no, amount, reason, status, created_at FROM supplementary_deductions WHERE plate_number = ? ORDER BY created_at DESC`, plate)
			defer rows.Close()

			var list []gin.H
			for rows.Next() {
				var s SupplementaryDeduction
				rows.Scan(&s.SupplementaryNo, &s.Amount, &s.Reason, &s.Status, &s.CreatedAt)
				list = append(list, gin.H{
					"supplementary_no": s.SupplementaryNo,
					"amount":           s.Amount,
					"reason":           s.Reason,
					"status":           s.Status,
					"created_at":       s.CreatedAt,
				})
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: list})
		})

		supp.POST("/:no/review", func(c *gin.Context) {
			rawBody := getRawBody(c)
			no := c.Param("no")
			var req struct {
				Action       string `json:"action"`
				Reviewer     string `json:"reviewer"`
				ReviewRemark string `json:"review_remark"`
			}
			c.ShouldBindJSON(&req)

			if req.Action == "" || req.Reviewer == "" {
				logException("param_validation_error", rawBody, "缺少审核参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少审核参数"})
				return
			}

			var s SupplementaryDeduction
			err := db.QueryRow(`SELECT id, plate_number, amount, status FROM supplementary_deductions WHERE supplementary_no = ?`, no).
				Scan(&s.ID, &s.PlateNumber, &s.Amount, &s.Status)
			if err == sql.ErrNoRows {
				logException("supplementary_not_found", rawBody, "补扣申请不存在", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "补扣申请不存在"})
				return
			}

			if s.Status != "pending" {
				logException("supplementary_invalid_status", rawBody, "当前状态非pending，无法审核", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "当前状态无法审核"})
				return
			}

			if req.Action != "approved" && req.Action != "rejected" && req.Action != "compensated" {
				logException("supplementary_invalid_action", rawBody, "无效的审核操作", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "无效的审核操作"})
				return
			}

			db.Exec(`UPDATE supplementary_deductions SET status = ?, reviewer = ?, review_remark = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
				req.Action, req.Reviewer, req.ReviewRemark, s.ID)

			if req.Action == "approved" {
				var v Vehicle
				err := db.QueryRow(`SELECT id, balance FROM vehicles WHERE plate_number = ?`, s.PlateNumber).Scan(&v.ID, &v.Balance)
				if err != nil {
					logException("supplementary_vehicle_not_found", rawBody, "车辆未注册，无法执行补扣", "返回失败", c.Request.URL.Path)
					c.JSON(http.StatusOK, gin.H{
						"success":          false,
						"supplementary_no": no,
						"status":           "failed",
						"message":          "车辆未注册，无法执行补扣",
					})
					return
				}

				if v.Balance < s.Amount {
					logException("supplementary_balance_insufficient", rawBody, fmt.Sprintf("余额不足: 当前%.2f元", v.Balance), "返回余额不足", c.Request.URL.Path)
					c.JSON(http.StatusOK, gin.H{
						"success":          false,
						"supplementary_no": no,
						"status":           "balance_insufficient",
						"current_balance":  v.Balance,
						"required_amount":  s.Amount,
						"message":          "余额不足",
					})
					return
				}

				balanceAfter := v.Balance - s.Amount
				deductionNo := generateDeductionNo()
				tx, _ := db.Begin()
				tx.Exec(`UPDATE vehicles SET balance = ? WHERE id = ?`, balanceAfter, v.ID)
				tx.Exec(`INSERT INTO deduction_records (deduction_no, plate_number, vehicle_id, amount, deduction_type, balance_before, balance_after, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					deductionNo, s.PlateNumber, v.ID, s.Amount, "supplementary", v.Balance, balanceAfter, "补扣执行")
				tx.Exec(`UPDATE supplementary_deductions SET status = 'deducted', deducted_at = CURRENT_TIMESTAMP WHERE id = ?`, s.ID)
				tx.Commit()

				logException("supplementary_deducted", rawBody, fmt.Sprintf("补扣执行成功: %.2f元", s.Amount), "补扣成功，余额已更新", c.Request.URL.Path)
				c.JSON(http.StatusOK, gin.H{
					"success":          true,
					"supplementary_no": no,
					"status":           "deducted",
					"amount":           s.Amount,
					"balance_after":    balanceAfter,
				})
				return
			}

			logException("supplementary_"+req.Action, rawBody, fmt.Sprintf("补扣申请%s", req.Action), "状态更新为"+req.Action, c.Request.URL.Path)
			c.JSON(http.StatusOK, gin.H{
				"success":          true,
				"supplementary_no": no,
				"status":           req.Action,
				"message":          map[string]string{"rejected": "已驳回", "compensated": "已补偿免扣"}[req.Action],
			})
		})

		supp.GET("/flow", func(c *gin.Context) {
			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{
				"pending":    []string{"approved", "rejected", "compensated"},
				"approved":   []string{"deducted"},
				"rejected":   []string{},
				"compensated": []string{},
				"deducted":   []string{},
			}})
		})
	}
}

func setupReconciliationRoutes(api *gin.RouterGroup) {
	rec := api.Group("/reconciliation")
	{
		rec.POST("/summary", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var req struct {
				Date string `json:"date"`
			}
			c.ShouldBindJSON(&req)

			date := req.Date
			if date == "" {
				date = time.Now().Format("2006-01-02")
			}

			startOfDay := date + " 00:00:00"
			endOfDay := date + " 23:59:59"

			var totalGateEvents int
			db.QueryRow(`SELECT COUNT(*) FROM gate_events WHERE event_time >= ? AND event_time <= ?`, startOfDay, endOfDay).Scan(&totalGateEvents)

			var totalRenewals int
			var renewalAmount float64
			db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM deduction_records WHERE deduction_time >= ? AND deduction_time <= ? AND deduction_type = 'monthly_renewal'`,
				startOfDay, endOfDay).Scan(&totalRenewals, &renewalAmount)

			var totalTemporary int
			var temporaryAmount float64
			db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM deduction_records WHERE deduction_time >= ? AND deduction_time <= ? AND deduction_type = 'temporary'`,
				startOfDay, endOfDay).Scan(&totalTemporary, &temporaryAmount)

			var totalSupplementary int
			var supplementaryAmount float64
			db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM deduction_records WHERE deduction_time >= ? AND deduction_time <= ? AND deduction_type = 'supplementary'`,
				startOfDay, endOfDay).Scan(&totalSupplementary, &supplementaryAmount)

			var totalActual float64
			db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM deduction_records WHERE deduction_time >= ? AND deduction_time <= ? AND amount > 0`,
				startOfDay, endOfDay).Scan(&totalActual)

			discrepancy := totalActual - (renewalAmount + temporaryAmount + supplementaryAmount)

			db.Exec(`INSERT OR REPLACE INTO reconciliation_summaries (summary_date, total_renewals, renewal_amount, total_temporary_deductions, temporary_amount, total_gate_events, total_supplementary, supplementary_amount, discrepancy_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated')`,
				date, totalRenewals, renewalAmount, totalTemporary, temporaryAmount, totalGateEvents, totalSupplementary, supplementaryAmount, discrepancy)

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{
				"summary_date":              date,
				"total_renewals":            totalRenewals,
				"renewal_amount":            renewalAmount,
				"total_temporary_deductions": totalTemporary,
				"temporary_amount":          temporaryAmount,
				"total_gate_events":         totalGateEvents,
				"total_supplementary":       totalSupplementary,
				"supplementary_amount":      supplementaryAmount,
				"discrepancy_amount":        discrepancy,
				"total_amount":              totalActual,
			}})
		})

		rec.GET("/summary/list", func(c *gin.Context) {
			start := c.Query("start_date")
			end := c.Query("end_date")

			if start == "" || end == "" {
				logException("param_validation_error", "", "缺少日期范围参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少日期范围参数"})
				return
			}

			rows, _ := db.Query(`SELECT summary_date, total_renewals, renewal_amount, total_temporary_deductions, temporary_amount, total_gate_events, total_supplementary, supplementary_amount, discrepancy_amount, status FROM reconciliation_summaries WHERE summary_date >= ? AND summary_date <= ? ORDER BY summary_date DESC`, start, end)
			defer rows.Close()

			var list []gin.H
			for rows.Next() {
				var s ReconciliationSummary
				rows.Scan(&s.SummaryDate, &s.TotalRenewals, &s.RenewalAmount, &s.TotalTemporaryDeductions, &s.TemporaryAmount, &s.TotalGateEvents, &s.TotalSupplementary, &s.SupplementaryAmount, &s.DiscrepancyAmount, &s.Status)
				list = append(list, gin.H{
					"summary_date":               s.SummaryDate,
					"total_renewals":             s.TotalRenewals,
					"renewal_amount":             s.RenewalAmount,
					"total_temporary_deductions": s.TotalTemporaryDeductions,
					"temporary_amount":           s.TemporaryAmount,
					"total_gate_events":          s.TotalGateEvents,
					"total_supplementary":        s.TotalSupplementary,
					"supplementary_amount":       s.SupplementaryAmount,
					"discrepancy_amount":         s.DiscrepancyAmount,
					"status":                     s.Status,
				})
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: list})
		})

		rec.GET("/summary/:date", func(c *gin.Context) {
			date := c.Param("date")
			var s ReconciliationSummary
			err := db.QueryRow(`SELECT summary_date, total_renewals, renewal_amount, total_temporary_deductions, temporary_amount, total_gate_events, total_supplementary, supplementary_amount, discrepancy_amount, status FROM reconciliation_summaries WHERE summary_date = ?`, date).
				Scan(&s.SummaryDate, &s.TotalRenewals, &s.RenewalAmount, &s.TotalTemporaryDeductions, &s.TemporaryAmount, &s.TotalGateEvents, &s.TotalSupplementary, &s.SupplementaryAmount, &s.DiscrepancyAmount, &s.Status)

			if err == sql.ErrNoRows {
				logException("summary_not_found", date, "对账摘要不存在", "返回404", c.Request.URL.Path)
				c.JSON(http.StatusNotFound, Response{Success: false, Error: "对账摘要不存在"})
				return
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: s})
		})

		rec.POST("/export", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var req struct {
				StartDate  string `json:"start_date"`
				EndDate    string `json:"end_date"`
				ExportPath string `json:"export_path"`
			}
			c.ShouldBindJSON(&req)

			if req.StartDate == "" || req.EndDate == "" {
				logException("param_validation_error", rawBody, "缺少日期范围参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少日期范围参数"})
				return
			}

			exportPath := req.ExportPath
			if exportPath == "" {
				exportPath = "./exports/reconciliation-go.csv"
			}

			os.MkdirAll("./exports", 0755)

			start := req.StartDate + " 00:00:00"
			end := req.EndDate + " 23:59:59"

			rows, _ := db.Query(`SELECT deduction_no, plate_number, amount, deduction_type, deduction_time, balance_before, balance_after, status, remark FROM deduction_records WHERE deduction_time >= ? AND deduction_time <= ? ORDER BY deduction_time DESC`, start, end)
			defer rows.Close()

			file, _ := os.Create(exportPath)
			defer file.Close()
			writer := csv.NewWriter(file)
			defer writer.Flush()

			typeMap := map[string]string{
				"monthly_renewal": "月租续费",
				"temporary":       "临停扣费",
				"supplementary":   "补扣执行",
				"recharge":        "账户充值",
				"correction":      "人工调账",
			}

			writer.Write([]string{"扣费单号", "车牌号", "金额", "扣费类型", "扣费时间", "扣前余额", "扣后余额", "状态", "备注"})

			count := 0
			for rows.Next() {
				var d DeductionRecord
				rows.Scan(&d.DeductionNo, &d.PlateNumber, &d.Amount, &d.DeductionType, &d.DeductionTime, &d.BalanceBefore, &d.BalanceAfter, &d.Status, &d.Remark)
				typeName, ok := typeMap[d.DeductionType]
				if !ok {
					typeName = d.DeductionType
				}
				writer.Write([]string{
					d.DeductionNo,
					d.PlateNumber,
					fmt.Sprintf("%.2f", d.Amount),
					typeName,
					d.DeductionTime.String(),
					fmt.Sprintf("%.2f", d.BalanceBefore),
					fmt.Sprintf("%.2f", d.BalanceAfter),
					d.Status,
					d.Remark,
				})
				count++
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{
				"file_path":   exportPath,
				"record_count": count,
				"date_range":  gin.H{"start": req.StartDate, "end": req.EndDate},
			}})
		})

		rec.POST("/correct", func(c *gin.Context) {
			rawBody := getRawBody(c)
			var req struct {
				DeductionNo string  `json:"deduction_no"`
				NewAmount   float64 `json:"new_amount"`
				Reason      string  `json:"reason"`
				Operator    string  `json:"operator"`
			}
			c.ShouldBindJSON(&req)

			if req.DeductionNo == "" || req.Reason == "" || req.Operator == "" {
				logException("param_validation_error", rawBody, "缺少必要参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少必要参数"})
				return
			}

			var d DeductionRecord
			err := db.QueryRow(`SELECT plate_number, vehicle_id, amount FROM deduction_records WHERE deduction_no = ?`, req.DeductionNo).
				Scan(&d.PlateNumber, &d.VehicleID, &d.Amount)
			if err == sql.ErrNoRows {
				logException("deduction_not_found", rawBody, "扣费记录不存在", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "扣费记录不存在"})
				return
			}

			var v Vehicle
			db.QueryRow(`SELECT balance FROM vehicles WHERE id = ?`, d.VehicleID).Scan(&v.Balance)

			amountDiff := req.NewAmount - d.Amount
			newBalance := v.Balance - amountDiff
			db.Exec(`UPDATE vehicles SET balance = ? WHERE id = ?`, newBalance, d.VehicleID)

			correctionNo := generateDeductionNo()
			db.Exec(`INSERT INTO deduction_records (deduction_no, plate_number, vehicle_id, amount, deduction_type, balance_before, balance_after, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				correctionNo, d.PlateNumber, d.VehicleID, -amountDiff, "correction", v.Balance, newBalance,
				fmt.Sprintf("人工调账: %s, 操作人: %s, 原单号: %s", req.Reason, req.Operator, req.DeductionNo))

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{
				"original_deduction_no": req.DeductionNo,
				"original_amount":       d.Amount,
				"new_amount":            req.NewAmount,
				"amount_diff":           amountDiff,
				"new_balance":           newBalance,
				"reason":                req.Reason,
			}})
		})
	}
}

func setupExceptionRoutes(api *gin.RouterGroup) {
	exceptions := api.Group("/exceptions")
	{
		exceptions.GET("", func(c *gin.Context) {
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
			offset := (page - 1) * pageSize

			rows, _ := db.Query(`SELECT id, exception_type, raw_input, error_message, processing_result, api_path, created_at FROM exception_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`, pageSize, offset)
			defer rows.Close()

			var list []ExceptionLog
			for rows.Next() {
				var e ExceptionLog
				rows.Scan(&e.ID, &e.ExceptionType, &e.RawInput, &e.ErrorMessage, &e.ProcessingResult, &e.APIPath, &e.CreatedAt)
				list = append(list, e)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: list})
		})
	}
}
