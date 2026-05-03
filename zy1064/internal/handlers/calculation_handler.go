package handlers

import (
	"coupon-risk-calculator/internal/config"
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/engine"
	"coupon-risk-calculator/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CalculationHandler struct {
	db          *gorm.DB
	productRepo *database.ProductRepo
	couponRepo  *database.CouponRepo
	memberRepo  *database.MembershipRepo
	cartRepo    *database.CartRepo
	resultRepo  *database.CalculationResultRepo
	engine      *engine.CalculationEngine
}

func NewCalculationHandler(db *gorm.DB) *CalculationHandler {
	cfg := config.Load()
	return &CalculationHandler{
		db:          db,
		productRepo: database.NewProductRepo(db),
		couponRepo:  database.NewCouponRepo(db),
		memberRepo:  database.NewMembershipRepo(db),
		cartRepo:    database.NewCartRepo(db),
		resultRepo:  database.NewCalculationResultRepo(db),
		engine:      engine.NewCalculationEngine(cfg),
	}
}

type CalculateSingleRequest struct {
	CartID           uint                   `json:"cart_id"`
	MembershipLevel  models.MembershipLevel `json:"membership_level"`
	Items            []CartItemRequest      `json:"items"`
}

func (h *CalculationHandler) CalculateSingle(c *gin.Context) {
	var req CalculateSingleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "请求参数错误",
				"details": err.Error(),
			},
		})
		return
	}
	
	var cart *models.Cart
	var err error
	
	if req.CartID > 0 {
		cart, err = h.cartRepo.FindByID(req.CartID)
		if err != nil {
			c.Error(err)
			return
		}
	} else if len(req.Items) > 0 {
		var items []models.CartItem
		for _, itemReq := range req.Items {
			items = append(items, models.CartItem{
				ProductID: itemReq.ProductID,
				SKU:       itemReq.SKU,
				Quantity:  itemReq.Quantity,
				UnitPrice: itemReq.UnitPrice,
			})
		}
		cart = &models.Cart{
			Name:            "临时购物车",
			MembershipLevel: req.MembershipLevel,
			Items:           items,
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "请提供 cart_id 或 items",
				"details": "必须指定购物车ID或直接提供商品列表",
			},
		})
		return
	}
	
	if req.MembershipLevel != "" {
		cart.MembershipLevel = req.MembershipLevel
	}
	
	products, err := h.productRepo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	productMap := make(map[uint]*models.Product)
	for i := range products {
		productMap[products[i].ID] = &products[i]
	}
	
	activeCoupons, err := h.couponRepo.ListActive()
	if err != nil {
		c.Error(err)
		return
	}
	
	var membership *models.Membership
	if cart.MembershipLevel != "" {
		membership, err = h.memberRepo.FindByLevel(cart.MembershipLevel)
		if err != nil && err != models.ErrMembershipNotFound {
			c.Error(err)
			return
		}
	}
	
	result, err := h.engine.Calculate(cart, productMap, activeCoupons, membership)
	if err != nil {
		c.Error(err)
		return
	}
	
	if req.CartID > 0 {
		result.CartID = req.CartID
		if err := h.resultRepo.Create(result); err != nil {
			c.Error(err)
			return
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

type CalculateBatchRequest struct {
	CartIDs          []uint                 `json:"cart_ids"`
	MembershipLevel  models.MembershipLevel `json:"membership_level"`
	SaveResults      bool                   `json:"save_results"`
}

func (h *CalculationHandler) CalculateBatch(c *gin.Context) {
	var req CalculateBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "请求参数错误",
				"details": err.Error(),
			},
		})
		return
	}
	
	var carts []*models.Cart
	
	if len(req.CartIDs) > 0 {
		for _, cartID := range req.CartIDs {
			cart, err := h.cartRepo.FindByID(cartID)
			if err != nil {
				c.Error(err)
				return
			}
			if req.MembershipLevel != "" {
				cart.MembershipLevel = req.MembershipLevel
			}
			carts = append(carts, cart)
		}
	} else {
		allCarts, err := h.cartRepo.List()
		if err != nil {
			c.Error(err)
			return
		}
		for i := range allCarts {
			if req.MembershipLevel != "" {
				allCarts[i].MembershipLevel = req.MembershipLevel
			}
			carts = append(carts, &allCarts[i])
		}
	}
	
	if len(carts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "没有可计算的购物车",
				"details": "请先导入购物车数据",
			},
		})
		return
	}
	
	products, err := h.productRepo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	productMap := make(map[uint]*models.Product)
	for i := range products {
		productMap[products[i].ID] = &products[i]
	}
	
	activeCoupons, err := h.couponRepo.ListActive()
	if err != nil {
		c.Error(err)
		return
	}
	
	var results []*models.CalculationResult
	var highRisk, mediumRisk, lowRisk int
	var totalMargin float64
	
	for _, cart := range carts {
		var membership *models.Membership
		if cart.MembershipLevel != "" {
			membership, _ = h.memberRepo.FindByLevel(cart.MembershipLevel)
		}
		
		result, err := h.engine.Calculate(cart, productMap, activeCoupons, membership)
		if err != nil {
			continue
		}
		
		result.CartID = cart.ID
		results = append(results, result)
		
		if req.SaveResults {
			h.resultRepo.Create(result)
		}
		
		switch result.RiskLevel {
		case string(models.RiskHigh):
			highRisk++
		case string(models.RiskMedium):
			mediumRisk++
		default:
			lowRisk++
		}
		totalMargin += result.GrossMargin
	}
	
	batchID := uuid.New().String()[:8]
	avgMargin := 0.0
	if len(results) > 0 {
		avgMargin = totalMargin / float64(len(results))
	}
	
	batchResult := models.BatchCalculationResult{
		BatchID:    batchID,
		TotalCarts: len(results),
		HighRisk:   highRisk,
		MediumRisk: mediumRisk,
		LowRisk:    lowRisk,
		AvgMargin:  avgMargin,
		Results:    make([]models.CalculationResult, len(results)),
	}
	
	for i, r := range results {
		batchResult.Results[i] = *r
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    batchResult,
	})
}
