package handlers

import (
	"car-wash-queue-api/models"
	"car-wash-queue-api/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func CreateQueueNumber(c *gin.Context) {
	var req struct {
		MemberID      *int `json:"member_id"`
		AppointmentID *int `json:"appointment_id"`
		ServiceType   string `json:"service_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "必填参数缺失",
		})
		return
	}

	queue, err := services.CreateQueueNumber(req.MemberID, req.AppointmentID, req.ServiceType)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "取号失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func GetQueueList(c *gin.Context) {
	status := c.Query("status")

	queues, err := services.GetQueueList(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "查询排队列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queues,
	})
}

func GetQueueByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的排队ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	queue, err := services.GetQueueByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success:    false,
			Message:    "排队号不存在",
			Conclusion: "找不到对应排队记录",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func CallNextQueue(c *gin.Context) {
	queue, err := services.CallNextQueue()
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "叫号失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func CompleteQueue(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的排队ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	queue, err := services.CompleteQueue(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "完成服务失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func MarkOvernumber(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的排队ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	queue, err := services.MarkOvernumber(id, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "标记过号失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func RequeueOvernumber(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的排队ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	queue, err := services.RequeueOvernumber(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "过号补排失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func CancelQueue(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的排队ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	queue, err := services.CancelQueue(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "取消排队失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}

func ManualUpdateQueue(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "无效的排队ID",
			Conclusion: "ID格式错误",
		})
		return
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    "请求参数错误",
			Conclusion: "JSON格式错误",
		})
		return
	}

	queue, err := services.ManualUpdateQueue(id, data)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Success:    false,
			Message:    err.Error(),
			Conclusion: "人工修正失败",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    queue,
	})
}
