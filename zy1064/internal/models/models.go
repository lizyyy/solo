package models

import (
	"time"

	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type CouponType string

const (
	CouponTypeFullReduction CouponType = "full_reduction"
	CouponTypeDiscount       CouponType = "discount"
	CouponTypeFreeShipping   CouponType = "free_shipping"
)

type MembershipLevel string

const (
	MembershipLevelRegular  MembershipLevel = "regular"
	MembershipLevelSilver   MembershipLevel = "silver"
	MembershipLevelGold     MembershipLevel = "gold"
	MembershipLevelPlatinum MembershipLevel = "platinum"
)

type Product struct {
	BaseModel
	SKU           string  `json:"sku" gorm:"uniqueIndex;not null"`
	Name          string  `json:"name" gorm:"not null"`
	OriginalPrice float64 `json:"original_price" gorm:"not null"`
	CostPrice     float64 `json:"cost_price" gorm:"not null"`
	Category      string  `json:"category"`
	Inventory     int64   `json:"inventory"`
	Description   string  `json:"description"`
}

type Coupon struct {
	BaseModel
	Code          string       `json:"code" gorm:"uniqueIndex;not null"`
	Name          string       `json:"name" gorm:"not null"`
	Type          CouponType   `json:"type" gorm:"not null"`
	Threshold     float64      `json:"threshold"`
	DiscountValue float64      `json:"discount_value"`
	DiscountRate  float64      `json:"discount_rate"`
	FreeShipping  bool         `json:"free_shipping"`
	CategoryLimit string       `json:"category_limit"`
	MutexGroup    string       `json:"mutex_group"`
	StackOrder    int          `json:"stack_order"`
	IsActive      bool         `json:"is_active"`
	Description   string       `json:"description"`
}

type Membership struct {
	BaseModel
	Level               MembershipLevel `json:"level" gorm:"uniqueIndex;not null"`
	Name                string          `json:"name" gorm:"not null"`
	DiscountRate        float64         `json:"discount_rate"`
	FreeShippingThreshold float64       `json:"free_shipping_threshold"`
	Description         string          `json:"description"`
}

type Cart struct {
	BaseModel
	Name             string          `json:"name" gorm:"not null"`
	MembershipLevel  MembershipLevel `json:"membership_level"`
	Items            []CartItem      `json:"items" gorm:"-"`
	AppliedCoupons   []string        `json:"applied_coupons" gorm:"-"`
	Notes            string          `json:"notes"`
}

type CartItem struct {
	BaseModel
	CartID    uint    `json:"cart_id" gorm:"index;not null"`
	ProductID uint    `json:"product_id" gorm:"not null"`
	SKU       string  `json:"sku" gorm:"not null"`
	Quantity  int64   `json:"quantity" gorm:"not null"`
	UnitPrice float64 `json:"unit_price"`
}

type CalculationResult struct {
	BaseModel
	CartID                uint              `json:"cart_id" gorm:"not null"`
	OriginalSubtotal      float64           `json:"original_subtotal"`
	MembershipDiscount    float64           `json:"membership_discount"`
	BestCombination       []string          `json:"best_combination" gorm:"-"`
	CouponDiscounts       map[string]float64 `json:"coupon_discounts" gorm:"-"`
	TotalDiscount         float64           `json:"total_discount"`
	FinalPrice            float64           `json:"final_price"`
	TotalCost             float64           `json:"total_cost"`
	GrossMargin           float64           `json:"gross_margin"`
	GrossMarginRate       float64           `json:"gross_margin_rate"`
	IsFreeShipping        bool              `json:"is_free_shipping"`
	RiskLevel             string            `json:"risk_level"`
	AppliedCoupons        []AppliedCoupon   `json:"applied_coupons" gorm:"-"`
	InapplicableCoupons   []InapplicableCoupon `json:"inapplicable_coupons" gorm:"-"`
	Explanation           string            `json:"explanation"`
	DetailsJSON           string            `json:"-" gorm:"column:details_json"`
}

type AppliedCoupon struct {
	CouponID   uint    `json:"coupon_id"`
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Discount   float64 `json:"discount"`
	ApplyOrder int     `json:"apply_order"`
}

type InapplicableCoupon struct {
	CouponID uint   `json:"coupon_id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	Reason   string `json:"reason"`
}

type BatchCalculationResult struct {
	BaseModel
	BatchID     string              `json:"batch_id" gorm:"uniqueIndex;not null"`
	TotalCarts  int                 `json:"total_carts"`
	HighRisk    int                 `json:"high_risk"`
	MediumRisk  int                 `json:"medium_risk"`
	LowRisk     int                 `json:"low_risk"`
	AvgMargin   float64             `json:"avg_margin"`
	Results     []CalculationResult `json:"results" gorm:"-"`
}

type RiskLevel string

const (
	RiskHigh   RiskLevel = "high"
	RiskMedium RiskLevel = "medium"
	RiskLow    RiskLevel = "low"
)
