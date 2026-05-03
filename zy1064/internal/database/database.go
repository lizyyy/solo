package database

import (
	"coupon-risk-calculator/internal/models"
	"errors"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(dbPath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&models.Product{},
		&models.Coupon{},
		&models.Membership{},
		&models.Cart{},
		&models.CartItem{},
		&models.CalculationResult{},
		&models.BatchCalculationResult{},
	)
	if err != nil {
		return nil, err
	}

	log.Println("Database initialized successfully")
	return db, nil
}

func CloseDB(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

type ProductRepo struct {
	db *gorm.DB
}

func NewProductRepo(db *gorm.DB) *ProductRepo {
	return &ProductRepo{db: db}
}

func (r *ProductRepo) Create(product *models.Product) error {
	if product.OriginalPrice < 0 {
		return models.ErrInvalidAmount
	}
	if product.CostPrice < 0 {
		return models.ErrInvalidAmount
	}
	return r.db.Create(product).Error
}

func (r *ProductRepo) BulkCreate(products []*models.Product) error {
	if len(products) == 0 {
		return nil
	}
	for _, p := range products {
		if p.OriginalPrice < 0 || p.CostPrice < 0 {
			return models.ErrInvalidAmount
		}
	}
	return r.db.Create(&products).Error
}

func (r *ProductRepo) FindByID(id uint) (*models.Product, error) {
	var product models.Product
	err := r.db.First(&product, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrProductNotFound
	}
	return &product, err
}

func (r *ProductRepo) FindBySKU(sku string) (*models.Product, error) {
	var product models.Product
	err := r.db.Where("sku = ?", sku).First(&product).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrProductNotFound
	}
	return &product, err
}

func (r *ProductRepo) List() ([]models.Product, error) {
	var products []models.Product
	err := r.db.Order("id ASC").Find(&products).Error
	return products, err
}

func (r *ProductRepo) Delete(id uint) error {
	result := r.db.Delete(&models.Product{}, id)
	if result.RowsAffected == 0 {
		return models.ErrProductNotFound
	}
	return result.Error
}

type CouponRepo struct {
	db *gorm.DB
}

func NewCouponRepo(db *gorm.DB) *CouponRepo {
	return &CouponRepo{db: db}
}

func (r *CouponRepo) Create(coupon *models.Coupon) error {
	if coupon.Threshold < 0 {
		return models.ErrInvalidThreshold
	}
	if coupon.Type == models.CouponTypeDiscount && (coupon.DiscountRate <= 0 || coupon.DiscountRate >= 1) {
		return models.ErrInvalidDiscount
	}
	return r.db.Create(coupon).Error
}

func (r *CouponRepo) BulkCreate(coupons []*models.Coupon) error {
	if len(coupons) == 0 {
		return nil
	}
	for _, c := range coupons {
		if c.Threshold < 0 {
			return models.ErrInvalidThreshold
		}
		if c.Type == models.CouponTypeDiscount && (c.DiscountRate <= 0 || c.DiscountRate >= 1) {
			return models.ErrInvalidDiscount
		}
	}
	return r.db.Create(&coupons).Error
}

func (r *CouponRepo) FindByID(id uint) (*models.Coupon, error) {
	var coupon models.Coupon
	err := r.db.First(&coupon, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrCouponNotFound
	}
	return &coupon, err
}

func (r *CouponRepo) FindByCode(code string) (*models.Coupon, error) {
	var coupon models.Coupon
	err := r.db.Where("code = ?", code).First(&coupon).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrCouponNotFound
	}
	return &coupon, err
}

func (r *CouponRepo) ListActive() ([]models.Coupon, error) {
	var coupons []models.Coupon
	err := r.db.Where("is_active = ?", true).Order("stack_order ASC").Find(&coupons).Error
	return coupons, err
}

func (r *CouponRepo) List() ([]models.Coupon, error) {
	var coupons []models.Coupon
	err := r.db.Order("id ASC").Find(&coupons).Error
	return coupons, err
}

func (r *CouponRepo) Delete(id uint) error {
	result := r.db.Delete(&models.Coupon{}, id)
	if result.RowsAffected == 0 {
		return models.ErrCouponNotFound
	}
	return result.Error
}

type MembershipRepo struct {
	db *gorm.DB
}

func NewMembershipRepo(db *gorm.DB) *MembershipRepo {
	return &MembershipRepo{db: db}
}

func (r *MembershipRepo) Create(m *models.Membership) error {
	if m.DiscountRate < 0 || m.DiscountRate > 1 {
		return models.ErrInvalidDiscount
	}
	if m.FreeShippingThreshold < 0 {
		return models.ErrInvalidThreshold
	}
	return r.db.Create(m).Error
}

func (r *MembershipRepo) BulkCreate(memberships []*models.Membership) error {
	if len(memberships) == 0 {
		return nil
	}
	for _, m := range memberships {
		if m.DiscountRate < 0 || m.DiscountRate > 1 {
			return models.ErrInvalidDiscount
		}
		if m.FreeShippingThreshold < 0 {
			return models.ErrInvalidThreshold
		}
	}
	return r.db.Create(&memberships).Error
}

func (r *MembershipRepo) FindByID(id uint) (*models.Membership, error) {
	var m models.Membership
	err := r.db.First(&m, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrMembershipNotFound
	}
	return &m, err
}

func (r *MembershipRepo) FindByLevel(level models.MembershipLevel) (*models.Membership, error) {
	var m models.Membership
	err := r.db.Where("level = ?", level).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrMembershipNotFound
	}
	return &m, err
}

func (r *MembershipRepo) List() ([]models.Membership, error) {
	var memberships []models.Membership
	err := r.db.Order("id ASC").Find(&memberships).Error
	return memberships, err
}

func (r *MembershipRepo) Delete(id uint) error {
	result := r.db.Delete(&models.Membership{}, id)
	if result.RowsAffected == 0 {
		return models.ErrMembershipNotFound
	}
	return result.Error
}

type CartRepo struct {
	db *gorm.DB
}

func NewCartRepo(db *gorm.DB) *CartRepo {
	return &CartRepo{db: db}
}

func (r *CartRepo) Create(cart *models.Cart) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(cart).Error; err != nil {
			return err
		}
		for i := range cart.Items {
			cart.Items[i].CartID = cart.ID
			if cart.Items[i].Quantity <= 0 {
				return models.ErrInvalidQuantity
			}
			if cart.Items[i].UnitPrice < 0 {
				return models.ErrInvalidAmount
			}
		}
		if len(cart.Items) > 0 {
			if err := tx.Create(&cart.Items).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *CartRepo) BulkCreate(carts []*models.Cart) error {
	for _, cart := range carts {
		if err := r.Create(cart); err != nil {
			return err
		}
	}
	return nil
}

func (r *CartRepo) FindByID(id uint) (*models.Cart, error) {
	var cart models.Cart
	err := r.db.First(&cart, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrCartNotFound
	}
	
	var items []models.CartItem
	if err := r.db.Where("cart_id = ?", id).Find(&items).Error; err != nil {
		return nil, err
	}
	cart.Items = items
	
	return &cart, err
}

func (r *CartRepo) List() ([]models.Cart, error) {
	var carts []models.Cart
	err := r.db.Order("id ASC").Find(&carts).Error
	if err != nil {
		return nil, err
	}
	
	for i := range carts {
		var items []models.CartItem
		if err := r.db.Where("cart_id = ?", carts[i].ID).Find(&items).Error; err != nil {
			return nil, err
		}
		carts[i].Items = items
	}
	
	return carts, nil
}

func (r *CartRepo) Delete(id uint) error {
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("cart_id = ?", id).Delete(&models.CartItem{}).Error; err != nil {
			return err
		}
		result := tx.Delete(&models.Cart{}, id)
		if result.RowsAffected == 0 {
			return models.ErrCartNotFound
		}
		return result.Error
	})
	return err
}

type CalculationResultRepo struct {
	db *gorm.DB
}

func NewCalculationResultRepo(db *gorm.DB) *CalculationResultRepo {
	return &CalculationResultRepo{db: db}
}

func (r *CalculationResultRepo) Create(result *models.CalculationResult) error {
	return r.db.Create(result).Error
}

func (r *CalculationResultRepo) FindByID(id uint) (*models.CalculationResult, error) {
	var result models.CalculationResult
	err := r.db.First(&result, id).Error
	return &result, err
}

func (r *CalculationResultRepo) List() ([]models.CalculationResult, error) {
	var results []models.CalculationResult
	err := r.db.Order("created_at DESC").Find(&results).Error
	return results, err
}

func (r *CalculationResultRepo) GetRiskSummary() (high, medium, low int64, err error) {
	err = r.db.Model(&models.CalculationResult{}).Where("risk_level = ?", "high").Count(&high).Error
	if err != nil {
		return 0, 0, 0, err
	}
	err = r.db.Model(&models.CalculationResult{}).Where("risk_level = ?", "medium").Count(&medium).Error
	if err != nil {
		return 0, 0, 0, err
	}
	err = r.db.Model(&models.CalculationResult{}).Where("risk_level = ?", "low").Count(&low).Error
	if err != nil {
		return 0, 0, 0, err
	}
	return high, medium, low, nil
}
