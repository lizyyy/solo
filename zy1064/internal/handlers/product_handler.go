package handlers

import (
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProductHandler struct {
	repo *database.ProductRepo
}

func NewProductHandler(db *gorm.DB) *ProductHandler {
	return &ProductHandler{
		repo: database.NewProductRepo(db),
	}
}

type ImportProductsRequest struct {
	Products []struct {
		SKU           string  `json:"sku" binding:"required"`
		Name          string  `json:"name" binding:"required"`
		OriginalPrice float64 `json:"original_price" binding:"required"`
		CostPrice     float64 `json:"cost_price" binding:"required"`
		Category      string  `json:"category"`
		Inventory     int64   `json:"inventory"`
		Description   string  `json:"description"`
	} `json:"products" binding:"required"`
}

func (h *ProductHandler) ImportProducts(c *gin.Context) {
	var req ImportProductsRequest
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
	
	var products []*models.Product
	for _, p := range req.Products {
		products = append(products, &models.Product{
			SKU:           p.SKU,
			Name:          p.Name,
			OriginalPrice: p.OriginalPrice,
			CostPrice:     p.CostPrice,
			Category:      p.Category,
			Inventory:     p.Inventory,
			Description:   p.Description,
		})
	}
	
	if err := h.repo.BulkCreate(products); err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "商品导入成功",
		"count":   len(products),
	})
}

func (h *ProductHandler) ListProducts(c *gin.Context) {
	products, err := h.repo.List()
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    products,
	})
}

func (h *ProductHandler) GetProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "无效的ID",
				"details": err.Error(),
			},
		})
		return
	}
	
	product, err := h.repo.FindByID(uint(id))
	if err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    product,
	})
}

func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    http.StatusBadRequest,
				"message": "无效的ID",
				"details": err.Error(),
			},
		})
		return
	}
	
	if err := h.repo.Delete(uint(id)); err != nil {
		c.Error(err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "商品已删除",
	})
}
