package handler

import (
	"fmt"

	// 违规：handler 层直接导入 repository 层
	"test-project/repository"
	"test-project/service"

	"github.com/gin-gonic/gin"
)

// TODO: 2024-01-01 这个功能需要重构，已经过期了
// FIXME: 需要修复这个 bug

func GetUser(c *gin.Context) {
	// 违规：裸返回 error
	user, err := service.GetUserByID(1)
	if err != nil {
		return err
	}

	c.JSON(200, user)
}

func CreateUser(c *gin.Context) {
	var user repository.User
	c.ShouldBindJSON(&user)

	// 违规：直接调用 repository
	err := repository.CreateUser(&user)
	if err != nil {
		// 违规：裸返回 error
		return nil, err
	}

	// 违规：未处理错误
	fmt.Println("User created")

	c.JSON(201, user)
}

// TODO: 需要添加删除用户功能
func DeleteUser(c *gin.Context) {
	// 违规：忽略错误
	_ = service.DeleteUser(1)

	c.JSON(200, gin.H{"message": "deleted"})
}
