package main

import (
	"database/sql"
	"log"
	"net/http"
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

type GateEvent struct {
	ID            int       `json:"id"`
	EventID       string    `json:"event_id"`
	PlateNumber   string    `json:"plate_number"`
	EventType     string    `json:"event_type"`
	EventTime     string    `json:"event_time"`
	GateID        string    `json:"gate_id"`
	Direction     string    `json:"direction"`
	Processed     int       `json:"processed"`
	Deduplicated  int       `json:"deduplicated"`
	CreatedAt     time.Time `json:"created_at"`
}

type DeductionRecord struct {
	ID            int       `json:"id"`
	DeductionNo   string    `json:"deduction_no"`
	PlateNumber   string    `json:"plate_number"`
	VehicleID     int       `json:"vehicle_id"`
	SubscriptionID int      `json:"subscription_id"`
	EventID       string    `json:"event_id"`
	Amount        float64   `json:"amount"`
	DeductionType string    `json:"deduction_type"`
	DeductionTime time.Time `json:"deduction_time"`
	BalanceBefore float64   `json:"balance_before"`
	BalanceAfter  float64   `json:"balance_after"`
	Status        string    `json:"status"`
	Remark        string    `json:"remark"`
	CreatedAt     time.Time `json:"created_at"`
}

type SupplementaryDeduction struct {
	ID               int       `json:"id"`
	SupplementaryNo  string    `json:"supplementary_no"`
	PlateNumber      string    `json:"plate_number"`
	OriginalEventID  string    `json:"original_event_id"`
	Amount           float64   `json:"amount"`
	Reason           string    `json:"reason"`
	Status           string    `json:"status"`
	Applicant        string    `json:"applicant"`
	Reviewer         string    `json:"reviewer"`
	ReviewRemark     string    `json:"review_remark"`
	CreatedAt        time.Time `json:"created_at"`
	ReviewedAt       time.Time `json:"reviewed_at"`
	DeductedAt       time.Time `json:"deducted_at"`
}

type ReconciliationSummary struct {
	ID                    int       `json:"id"`
	SummaryDate           string    `json:"summary_date"`
	TotalRenewals         int       `json:"total_renewals"`
	RenewalAmount         float64   `json:"renewal_amount"`
	TotalTemporaryDeductions int    `json:"total_temporary_deductions"`
	TemporaryAmount       float64   `json:"temporary_amount"`
	TotalGateEvents       int       `json:"total_gate_events"`
	TotalSupplementary    int       `json:"total_supplementary"`
	SupplementaryAmount   float64   `json:"supplementary_amount"`
	DiscrepancyAmount     float64   `json:"discrepancy_amount"`
	Status                string    `json:"status"`
	GeneratedAt           time.Time `json:"generated_at"`
}

type ExceptionLog struct {
	ID              int       `json:"id"`
	ExceptionType   string    `json:"exception_type"`
	RawInput        string    `json:"raw_input"`
	ErrorMessage    string    `json:"error_message"`
	ProcessingResult string   `json:"processing_result"`
	APIPath         string    `json:"api_path"`
	CreatedAt       time.Time `json:"created_at"`
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
	r.Run(":8080")
}

func setupVehicleRoutes(api *gin.RouterGroup) {
	vehicles := api.Group("/vehicles")
	{
		vehicles.POST("", func(c *gin.Context) {
			var v Vehicle
			if err := c.ShouldBindJSON(&v); err != nil {
				logException("param_validation_error", c.Request.Body.String(), err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if v.PlateNumber == "" {
				logException("param_validation_error", "", "车牌号不能为空", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "车牌号不能为空"})
				return
			}

			result, err := db.Exec(`INSERT INTO vehicles (plate_number, owner_name, owner_phone, balance) VALUES (?, ?, ?, 0)`,
				v.PlateNumber, v.OwnerName, v.OwnerPhone)
			if err != nil {
				logException("create_vehicle_error", "", err.Error(), "返回500", c.Request.URL.Path)
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
			var req struct {
				PlateNumber string  `json:"plate_number"`
				Amount      float64 `json:"amount"`
			}
			if err := c.ShouldBindJSON(&req); err != nil || req.Amount <= 0 {
				logException("param_validation_error", "", "参数错误或金额无效", "返回400", c.Request.URL.Path)
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

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"recharged": req.Amount}})
		})
	}
}

func setupPlanRoutes(api *gin.RouterGroup) {
	plans := api.Group("/plans")
	{
		plans.POST("", func(c *gin.Context) {
			var p MonthlyPlan
			if err := c.ShouldBindJSON(&p); err != nil {
				logException("param_validation_error", "", err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if p.PlanName == "" || p.Price <= 0 || p.DurationDays <= 0 {
				logException("param_validation_error", "", "缺少必要参数或参数无效", "返回400", c.Request.URL.Path)
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
			var e GateEvent
			if err := c.ShouldBindJSON(&e); err != nil {
				logException("param_validation_error", "", err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			if e.EventID == "" || e.PlateNumber == "" {
				logException("param_validation_error", "", "缺少event_id或plate_number", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少必要参数"})
				return
			}

			var count int
			db.QueryRow(`SELECT COUNT(*) FROM gate_events WHERE event_id = ?`, e.EventID).Scan(&count)
			if count > 0 {
				logException("gate_event_duplicate", e.EventID, "事件已存在", "返回已处理", c.Request.URL.Path)
				c.JSON(http.StatusOK, gin.H{
					"success":   true,
					"duplicate": true,
					"message":   "事件已处理",
				})
				return
			}

			var v Vehicle
			err := db.QueryRow(`SELECT id, balance FROM vehicles WHERE plate_number = ?`, e.PlateNumber).Scan(&v.ID, &v.Balance)
			
			if err != nil {
				logException("unregistered_vehicle", e.PlateNumber, "未注册车辆", "返回未注册", c.Request.URL.Path)
			}

			db.Exec(`INSERT INTO gate_events (event_id, plate_number, event_type, event_time, gate_id, direction) VALUES (?, ?, ?, ?, ?, ?)`,
				e.EventID, e.PlateNumber, e.EventType, e.EventTime, e.GateID, e.Direction)

			c.JSON(http.StatusOK, gin.H{
				"success":      true,
				"event_id":     e.EventID,
				"plate_number": e.PlateNumber,
				"registered":   err == nil,
			})
		})
	}
}

func setupDeductionRoutes(api *gin.RouterGroup) {
	deductions := api.Group("/deductions")
	{
		deductions.GET("/plate/:plate", func(c *gin.Context) {
			plate := c.Param("plate")
			rows, _ := db.Query(`SELECT deduction_no, plate_number, amount, deduction_type, deduction_time, status FROM deduction_records WHERE plate_number = ? ORDER BY deduction_time DESC LIMIT 20`, plate)
			defer rows.Close()

			var records []DeductionRecord
			for rows.Next() {
				var d DeductionRecord
				rows.Scan(&d.DeductionNo, &d.PlateNumber, &d.Amount, &d.DeductionType, &d.DeductionTime, &d.Status)
				records = append(records, d)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: records})
		})
	}
}

func setupSupplementaryRoutes(api *gin.RouterGroup) {
	supp := api.Group("/supplementary")
	{
		supp.POST("", func(c *gin.Context) {
			var s SupplementaryDeduction
			if err := c.ShouldBindJSON(&s); err != nil {
				logException("param_validation_error", "", err.Error(), "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "参数错误"})
				return
			}

			suppNo := "BK" + time.Now().Format("20060102150405")
			db.Exec(`INSERT INTO supplementary_deductions (supplementary_no, plate_number, original_event_id, amount, reason, applicant, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
				suppNo, s.PlateNumber, s.OriginalEventID, s.Amount, s.Reason, s.Applicant)

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"supplementary_no": suppNo}})
		})

		supp.GET("/status/:status", func(c *gin.Context) {
			status := c.Param("status")
			rows, _ := db.Query(`SELECT supplementary_no, plate_number, amount, reason, status FROM supplementary_deductions WHERE status = ? ORDER BY created_at DESC`, status)
			defer rows.Close()

			var list []SupplementaryDeduction
			for rows.Next() {
				var s SupplementaryDeduction
				rows.Scan(&s.SupplementaryNo, &s.PlateNumber, &s.Amount, &s.Reason, &s.Status)
				list = append(list, s)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: list})
		})

		supp.POST("/:no/review", func(c *gin.Context) {
			no := c.Param("no")
			var req struct {
				Action      string `json:"action"`
				Reviewer    string `json:"reviewer"`
				ReviewRemark string `json:"review_remark"`
			}
			c.ShouldBindJSON(&req)

			if req.Action == "" || req.Reviewer == "" {
				logException("param_validation_error", "", "缺少审核参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少审核参数"})
				return
			}

			db.Exec(`UPDATE supplementary_deductions SET status = ?, reviewer = ?, review_remark = ?, reviewed_at = CURRENT_TIMESTAMP WHERE supplementary_no = ?`,
				req.Action, req.Reviewer, req.ReviewRemark, no)

			logException("supplementary_"+req.Action, no, "补扣审核完成", "状态更新为"+req.Action, c.Request.URL.Path)
			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"status": req.Action}})
		})
	}
}

func setupReconciliationRoutes(api *gin.RouterGroup) {
	rec := api.Group("/reconciliation")
	{
		rec.POST("/summary", func(c *gin.Context) {
			var req struct {
				Date string `json:"date"`
			}
			c.ShouldBindJSON(&req)

			date := req.Date
			if date == "" {
				date = time.Now().Format("2006-01-02")
			}

			db.Exec(`INSERT OR REPLACE INTO reconciliation_summaries (summary_date, total_gate_events, status) VALUES (?, 100, 'generated')`, date)

			c.JSON(http.StatusOK, Response{Success: true, Data: gin.H{"summary_date": date}})
		})

		rec.GET("/summary/list", func(c *gin.Context) {
			start := c.Query("start_date")
			end := c.Query("end_date")

			if start == "" || end == "" {
				logException("param_validation_error", "", "缺少日期范围参数", "返回400", c.Request.URL.Path)
				c.JSON(http.StatusBadRequest, Response{Success: false, Error: "缺少日期范围参数"})
				return
			}

			rows, _ := db.Query(`SELECT summary_date, total_renewals, renewal_amount, status FROM reconciliation_summaries WHERE summary_date >= ? AND summary_date <= ? ORDER BY summary_date DESC`, start, end)
			defer rows.Close()

			var list []ReconciliationSummary
			for rows.Next() {
				var s ReconciliationSummary
				rows.Scan(&s.SummaryDate, &s.TotalRenewals, &s.RenewalAmount, &s.Status)
				list = append(list, s)
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: list})
		})

		rec.GET("/summary/:date", func(c *gin.Context) {
			date := c.Param("date")
			var s ReconciliationSummary
			err := db.QueryRow(`SELECT summary_date, total_renewals, renewal_amount, total_gate_events, status FROM reconciliation_summaries WHERE summary_date = ?`, date).
				Scan(&s.SummaryDate, &s.TotalRenewals, &s.RenewalAmount, &s.TotalGateEvents, &s.Status)

			if err == sql.ErrNoRows {
				logException("summary_not_found", date, "对账摘要不存在", "返回404", c.Request.URL.Path)
				c.JSON(http.StatusNotFound, Response{Success: false, Error: "对账摘要不存在"})
				return
			}

			c.JSON(http.StatusOK, Response{Success: true, Data: s})
		})
	}
}

func setupExceptionRoutes(api *gin.RouterGroup) {
	exceptions := api.Group("/exceptions")
	{
		exceptions.GET("", func(c *gin.Context) {
			rows, _ := db.Query(`SELECT id, exception_type, raw_input, error_message, processing_result, api_path, created_at FROM exception_logs ORDER BY created_at DESC LIMIT 20`)
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
