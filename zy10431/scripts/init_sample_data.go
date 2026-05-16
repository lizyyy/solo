package main

import (
	"consumer-ownership-api/internal/model"
	"consumer-ownership-api/pkg/database"
	"fmt"
	"time"
)

func main() {
	if err := database.Init(); err != nil {
		fmt.Printf("数据库初始化失败: %v\n", err)
		return
	}

	sampleConsumers := []model.Consumer{
		{
			QueueName:     "order_created",
			ConsumerGroup: "payment-service",
			ProcessScope:  "支付处理、订单状态更新",
			Owner:         "张三",
			OwnerEmail:    "zhangsan@example.com",
			Status:        model.StatusActive,
			CreatedAt:     time.Now().AddDate(0, 0, -7),
			UpdatedAt:     time.Now().AddDate(0, 0, -7),
		},
		{
			QueueName:     "order_created",
			ConsumerGroup: "notification-service",
			ProcessScope:  "短信通知、邮件通知",
			Owner:         "李四",
			OwnerEmail:    "lisi@example.com",
			Status:        model.StatusActive,
			CreatedAt:     time.Now().AddDate(0, 0, -5),
			UpdatedAt:     time.Now().AddDate(0, 0, -5),
		},
		{
			QueueName:     "order_created",
			ConsumerGroup: "inventory-service",
			ProcessScope:  "库存扣减、库存预警",
			Owner:         "王五",
			OwnerEmail:    "wangwu@example.com",
			Status:        model.StatusActive,
			CreatedAt:     time.Now().AddDate(0, 0, -3),
			UpdatedAt:     time.Now().AddDate(0, 0, -3),
		},
		{
			QueueName:     "user_registered",
			ConsumerGroup: "user-service",
			ProcessScope:  "用户档案创建、积分初始化",
			Owner:         "赵六",
			OwnerEmail:    "zhaoliu@example.com",
			Status:        model.StatusActive,
			CreatedAt:     time.Now().AddDate(0, 0, -10),
			UpdatedAt:     time.Now().AddDate(0, 0, -10),
		},
		{
			QueueName:     "user_registered",
			ConsumerGroup: "coupon-service",
			ProcessScope:  "新人优惠券发放",
			Owner:         "钱七",
			OwnerEmail:    "qianqi@example.com",
			Status:        model.StatusInactive,
			CreatedAt:     time.Now().AddDate(0, 0, -15),
			UpdatedAt:     time.Now().AddDate(0, 0, -2),
		},
	}

	for i := range sampleConsumers {
		existing, err := database.FindConsumerByQueueAndGroup(
			sampleConsumers[i].QueueName,
			sampleConsumers[i].ConsumerGroup,
		)
		if err != nil {
			fmt.Printf("查询失败: %v\n", err)
			continue
		}
		if existing == nil {
			if err := database.CreateConsumer(&sampleConsumers[i]); err != nil {
				fmt.Printf("创建失败: %v\n", err)
			} else {
				fmt.Printf("已创建: %s - %s\n", sampleConsumers[i].QueueName, sampleConsumers[i].ConsumerGroup)
			}
		} else {
			fmt.Printf("已存在，跳过: %s - %s\n", sampleConsumers[i].QueueName, sampleConsumers[i].ConsumerGroup)
		}
	}

	fmt.Println("\n样例数据初始化完成！")
}
