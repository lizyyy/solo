package middleware

import (
	"coupon-risk-calculator/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			handleError(c, err.Err)
		}
	}
}

func handleError(c *gin.Context, err error) {
	switch e := err.(type) {
	case *models.AppError:
		c.JSON(e.Code, gin.H{
			"error": gin.H{
				"code":    e.Code,
				"message": e.Message,
				"details": e.Details,
			},
		})
		
	default:
		switch err {
		case models.ErrProductNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    http.StatusNotFound,
					"message": "商品不存在",
					"details": err.Error(),
				},
			})
		case models.ErrCouponNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    http.StatusNotFound,
					"message": "优惠券不存在",
					"details": err.Error(),
				},
			})
		case models.ErrMembershipNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    http.StatusNotFound,
					"message": "会员等级不存在",
					"details": err.Error(),
				},
			})
		case models.ErrCartNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    http.StatusNotFound,
					"message": "购物车不存在",
					"details": err.Error(),
				},
			})
			
		case models.ErrInvalidAmount:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    http.StatusBadRequest,
					"message": "金额无效",
					"details": err.Error(),
				},
			})
		case models.ErrInvalidQuantity:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    http.StatusBadRequest,
					"message": "数量无效",
					"details": err.Error(),
				},
			})
		case models.ErrInvalidDiscount:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    http.StatusBadRequest,
					"message": "折扣无效",
					"details": err.Error(),
				},
			})
		case models.ErrInvalidThreshold:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    http.StatusBadRequest,
					"message": "门槛无效",
					"details": err.Error(),
				},
			})
			
		case models.ErrEmptyCart:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    http.StatusBadRequest,
					"message": "购物车为空",
					"details": "请先添加商品到购物车",
				},
			})
			
		case models.ErrMissingCostPrice:
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error": gin.H{
					"code":    http.StatusUnprocessableEntity,
					"message": "缺少成本价",
					"details": err.Error(),
				},
			})
			
		case models.ErrJSONUnmarshal, models.ErrJSONMarshal:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    http.StatusBadRequest,
					"message": "JSON格式错误",
					"details": err.Error(),
				},
			})
			
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    http.StatusInternalServerError,
					"message": "服务器内部错误",
					"details": err.Error(),
				},
			})
		}
	}
}
