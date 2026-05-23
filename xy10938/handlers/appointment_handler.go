package handlers

import (
	"car-wash-queue-api/models"
	"car-wash-queue-api/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CreateAppointment(c *gin.Context) {
	var req struct {
		MemberID        int    `json:"member_id" binding:"required"`
		ServiceType     string `json:"service_type" binding:"required"`
		AppointmentDate string `json:"appointment_date" binding:"required"`
		AppointmentTime string `json:"appointment_time" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "必填参数缺失",
		})
		return
	}

	appointment, err := services.CreateAppointment(req.MemberID, req.ServiceType, req.AppointmentDate, req.AppointmentTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "创建预约失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}

func GetAppointmentList(c *gin.Context) {
	date := c.Query("date")

	appointments, err := services.GetAppointmentList(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询预约列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointments,
	})
}

func GetAppointmentByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的预约ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	appointment, err := services.GetAppointmentByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success:    false,
			Message:    "预约不存在",
			Conclusion: "找不到对应预约记录",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}

func LockAppointment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的预约ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	var req struct {
		StationID int `json:"station_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "必填参数缺失",
		})
		return
	}

	appointment, err := services.LockAppointment(id, req.StationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "预约锁位失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}

func CancelAppointment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的预约ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	appointment, err := services.CancelAppointment(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "取消预约失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    appointment,
	})
}
