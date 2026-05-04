package handlers

import (
	"btc-recharge-service/models"
	"btc-recharge-service/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AddressHandler struct {
	addrSvc *services.AddressService
}

func NewAddressHandler(addrSvc *services.AddressService) *AddressHandler {
	return &AddressHandler{
		addrSvc: addrSvc,
	}
}

type APIResponse struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *AddressHandler) CreateAddress(c *gin.Context) {
	var req services.CreateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.addrSvc.CreateAddress(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "创建地址失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AddressHandler) GetAllAddresses(c *gin.Context) {
	addrs, err := h.addrSvc.GetAllAddresses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询地址列表失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    addrs,
	})
}

func (h *AddressHandler) GetAddressByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "无效的地址 ID",
		})
		return
	}

	addr, err := h.addrSvc.GetAddressByID(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询地址失败: " + err.Error(),
		})
		return
	}

	if addr == nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Code:    models.ResourceNotFound.Code,
			Message: models.ResourceNotFound.Message,
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    addr,
	})
}

func (h *AddressHandler) GetAddressesByUserID(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "用户 ID 不能为空",
		})
		return
	}

	addrs, err := h.addrSvc.GetAddressesByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询用户地址列表失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    addrs,
	})
}
