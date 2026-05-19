package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}

type Declaration struct {
	BaseModel
	BatchID           string          `gorm:"index;type:varchar(36)" json:"batch_id"`
	OrderNo           string          `gorm:"index;type:varchar(100)" json:"order_no"`
	TrackingNo        string          `gorm:"type:varchar(100)" json:"tracking_no"`
	Declarant         string          `gorm:"type:varchar(100)" json:"declarant"`
	DeclareDate       time.Time       `json:"declare_date"`
	HSCode            string          `gorm:"index;type:varchar(50)" json:"hs_code"`
	ProductName       string          `gorm:"type:varchar(255)" json:"product_name"`
	Category          string          `gorm:"type:varchar(100)" json:"category"`
	Quantity          int             `json:"quantity"`
	UnitPrice         decimal.Decimal `gorm:"type:decimal(20,4)" json:"unit_price"`
	TotalAmount       decimal.Decimal `gorm:"type:decimal(20,4)" json:"total_amount"`
	Currency          string          `gorm:"type:varchar(10)" json:"currency"`
	DeclaredTaxAmount decimal.Decimal `gorm:"type:decimal(20,4)" json:"declared_tax_amount"`
	Status            string          `gorm:"type:varchar(50)" json:"status"`
	RawData           string          `gorm:"type:text" json:"raw_data"`
}

type Tariff struct {
	BaseModel
	BatchID       string          `gorm:"index;type:varchar(36)" json:"batch_id"`
	HSCode        string          `gorm:"index;type:varchar(50)" json:"hs_code"`
	ProductName   string          `gorm:"type:varchar(255)" json:"product_name"`
	Category      string          `gorm:"type:varchar(100)" json:"category"`
	ParentHSCode  string          `gorm:"type:varchar(50)" json:"parent_hs_code"`
	TaxRate       decimal.Decimal `gorm:"type:decimal(10,6)" json:"tax_rate"`
	ConsumptionTax decimal.Decimal `gorm:"type:decimal(10,6)" json:"consumption_tax"`
	VATRate       decimal.Decimal `gorm:"type:decimal(10,6)" json:"vat_rate"`
	EffectiveDate time.Time       `json:"effective_date"`
	ExpiryDate    *time.Time      `json:"expiry_date"`
	IsActive      bool            `json:"is_active"`
	RawData       string          `gorm:"type:text" json:"raw_data"`
}

type ReturnReceipt struct {
	BaseModel
	BatchID         string          `gorm:"index;type:varchar(36)" json:"batch_id"`
	ReceiptNo       string          `gorm:"index;type:varchar(100)" json:"receipt_no"`
	OrderNo         string          `gorm:"index;type:varchar(100)" json:"order_no"`
	TrackingNo      string          `gorm:"type:varchar(100)" json:"tracking_no"`
	ReturnDate      time.Time       `json:"return_date"`
	ReturnCode      string          `gorm:"type:varchar(50)" json:"return_code"`
	ReturnReason    string          `gorm:"type:text" json:"return_reason"`
	ReturnCategory  string          `gorm:"type:varchar(100)" json:"return_category"`
	AdjustedAmount  decimal.Decimal `gorm:"type:decimal(20,4)" json:"adjusted_amount"`
	AdjustedTax     decimal.Decimal `gorm:"type:decimal(20,4)" json:"adjusted_tax"`
	RequireSupplement bool          `json:"require_supplement"`
	SupplementDeadline *time.Time   `json:"supplement_deadline"`
	Status          string          `gorm:"type:varchar(50)" json:"status"`
	RawData         string          `gorm:"type:text" json:"raw_data"`
}

type ReconciliationBatch struct {
	BaseModel
	Name                string    `gorm:"type:varchar(200)" json:"name"`
	DeclarationCount    int       `json:"declaration_count"`
	TariffCount         int       `json:"tariff_count"`
	ReturnReceiptCount  int       `json:"return_receipt_count"`
	Status              string    `gorm:"type:varchar(50)" json:"status"`
	MatchedCount        int       `json:"matched_count"`
	DiscrepancyCount    int       `json:"discrepancy_count"`
	ReviewedCount       int       `json:"reviewed_count"`
	TotalTaxExpected    decimal.Decimal `gorm:"type:decimal(20,4)" json:"total_tax_expected"`
	TotalTaxDeclared    decimal.Decimal `gorm:"type:decimal(20,4)" json:"total_tax_declared"`
	TotalTaxDifference  decimal.Decimal `gorm:"type:decimal(20,4)" json:"total_tax_difference"`
	ProcessedAt         *time.Time `json:"processed_at"`
	CompletedAt         *time.Time `json:"completed_at"`
}

type ReconciliationItem struct {
	BaseModel
	BatchID             string          `gorm:"index;type:varchar(36)" json:"batch_id"`
	OrderNo             string          `gorm:"index;type:varchar(100)" json:"order_no"`
	TrackingNo          string          `gorm:"type:varchar(100)" json:"tracking_no"`
	DeclarationID       string          `gorm:"type:varchar(36)" json:"declaration_id"`
	TariffID            string          `gorm:"type:varchar(36)" json:"tariff_id"`
	ReturnReceiptID     string          `gorm:"type:varchar(36)" json:"return_receipt_id"`
	HSCode              string          `gorm:"type:varchar(50)" json:"hs_code"`
	ProductName         string          `gorm:"type:varchar(255)" json:"product_name"`
	Category            string          `gorm:"type:varchar(100)" json:"category"`
	Quantity            int             `json:"quantity"`
	DeclaredAmount      decimal.Decimal `gorm:"type:decimal(20,4)" json:"declared_amount"`
	DeclaredCurrency    string          `gorm:"type:varchar(10)" json:"declared_currency"`
	DeclaredAmountCNY   decimal.Decimal `gorm:"type:decimal(20,4)" json:"declared_amount_cny"`
	ExchangeRate        decimal.Decimal `gorm:"type:decimal(12,6)" json:"exchange_rate"`
	ApplicableTaxRate   decimal.Decimal `gorm:"type:decimal(10,6)" json:"applicable_tax_rate"`
	ExpectedTaxAmount   decimal.Decimal `gorm:"type:decimal(20,4)" json:"expected_tax_amount"`
	DeclaredTaxAmount   decimal.Decimal `gorm:"type:decimal(20,4)" json:"declared_tax_amount"`
	TaxDifference       decimal.Decimal `gorm:"type:decimal(20,4)" json:"tax_difference"`
	HasReturnReceipt    bool            `json:"has_return_receipt"`
	ReturnAdjustedTax   decimal.Decimal `gorm:"type:decimal(20,4)" json:"return_adjusted_tax"`
	SupplementTaxNeeded decimal.Decimal `gorm:"type:decimal(20,4)" json:"supplement_tax_needed"`
	FinalTaxAmount      decimal.Decimal `gorm:"type:decimal(20,4)" json:"final_tax_amount"`
	Status              string          `gorm:"type:varchar(50)" json:"status"`
	IsReviewed          bool            `json:"is_reviewed"`
	ReviewedAt          *time.Time      `json:"reviewed_at"`
	ReviewedBy          string          `gorm:"type:varchar(100)" json:"reviewed_by"`
	ReviewNotes         string          `gorm:"type:text" json:"review_notes"`
}

type Discrepancy struct {
	BaseModel
	BatchID             string          `gorm:"index;type:varchar(36)" json:"batch_id"`
	ReconciliationItemID string         `gorm:"index;type:varchar(36)" json:"reconciliation_item_id"`
	OrderNo             string          `gorm:"type:varchar(100)" json:"order_no"`
	DiscrepancyType     string          `gorm:"type:varchar(50)" json:"discrepancy_type"`
	FieldName           string          `gorm:"type:varchar(100)" json:"field_name"`
	ExpectedValue       decimal.Decimal `gorm:"type:decimal(20,4)" json:"expected_value"`
	ActualValue         decimal.Decimal `gorm:"type:decimal(20,4)" json:"actual_value"`
	Difference          decimal.Decimal `gorm:"type:decimal(20,4)" json:"difference"`
	Explanation         string          `gorm:"type:text" json:"explanation"`
	Source              string          `gorm:"type:varchar(100)" json:"source"`
	Resolution          string          `gorm:"type:varchar(50)" json:"resolution"`
	IsResolved          bool            `json:"is_resolved"`
}

type ReviewRecord struct {
	BaseModel
	ReconciliationItemID string         `gorm:"index;type:varchar(36)" json:"reconciliation_item_id"`
	BatchID             string          `gorm:"index;type:varchar(36)" json:"batch_id"`
	OrderNo             string          `gorm:"type:varchar(100)" json:"order_no"`
	Reviewer            string          `gorm:"type:varchar(100)" json:"reviewer"`
	ReviewAction        string          `gorm:"type:varchar(50)" json:"review_action"`
	OldTaxAmount        decimal.Decimal `gorm:"type:decimal(20,4)" json:"old_tax_amount"`
	NewTaxAmount        decimal.Decimal `gorm:"type:decimal(20,4)" json:"new_tax_amount"`
	OldTaxRate          decimal.Decimal `gorm:"type:decimal(10,6)" json:"old_tax_rate"`
	NewTaxRate          decimal.Decimal `gorm:"type:decimal(10,6)" json:"new_tax_rate"`
	Notes               string          `gorm:"type:text" json:"notes"`
}

type ExchangeRate struct {
	BaseModel
	FromCurrency string          `gorm:"type:varchar(10)" json:"from_currency"`
	ToCurrency   string          `gorm:"type:varchar(10)" json:"to_currency"`
	RateDate     time.Time       `gorm:"index" json:"rate_date"`
	Rate         decimal.Decimal `gorm:"type:decimal(12,6)" json:"rate"`
	Source       string          `gorm:"type:varchar(100)" json:"source"`
}

type Report struct {
	BaseModel
	BatchID        string    `gorm:"index;type:varchar(36)" json:"batch_id"`
	ReportType     string    `gorm:"type:varchar(50)" json:"report_type"`
	ReportName     string    `gorm:"type:varchar(200)" json:"report_name"`
	GeneratedBy    string    `gorm:"type:varchar(100)" json:"generated_by"`
	GeneratedAt    time.Time `json:"generated_at"`
	FileFormat     string    `gorm:"type:varchar(20)" json:"file_format"`
	FileSize       int64     `json:"file_size"`
	FilePath       string    `gorm:"type:varchar(500)" json:"file_path"`
}

const (
	BatchStatusPending    = "pending"
	BatchStatusProcessing = "processing"
	BatchStatusProcessed  = "processed"
	BatchStatusReviewing  = "reviewing"
	BatchStatusCompleted  = "completed"

	ItemStatusMatched     = "matched"
	ItemStatusDiscrepancy = "discrepancy"
	ItemStatusReviewed    = "reviewed"

	DiscrepancyTypeTaxRate      = "tax_rate"
	DiscrepancyTypeCurrency     = "currency"
	DiscrepancyTypeAmount       = "amount"
	DiscrepancyTypeHSCode       = "hs_code"
	DiscrepancyTypeReturn       = "return"
	DiscrepancyTypeSupplement   = "supplement"
	DiscrepancyTypeDuplicate    = "duplicate"
)
