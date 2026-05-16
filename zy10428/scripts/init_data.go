package main

import (
	"encoding/json"
	"fmt"
	"log"
	"shadow-test-api/internal/model"
	"shadow-test-api/internal/storage"
)

func main() {
	store, err := storage.NewStorage("shadow_test.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	rules := []model.ProxyRule{
		{
			Name:        "API网关路由-v1",
			Description: "将/api/v1/* 路由到 /service/v1/*",
			PathPattern: "/api/v1/*",
			Method:      "GET",
			RewriteTo:   "/service/v1/$1",
			IsActive:    true,
		},
		{
			Name:        "API网关路由-v2",
			Description: "将/api/v2/* 路由到 /service/v2/*",
			PathPattern: "/api/v2/*",
			Method:      "*",
			RewriteTo:   "/service/v2/$1",
			IsActive:    true,
		},
		{
			Name:        "用户服务路由",
			Description: "将/user/* 路由到 /user-service/*",
			PathPattern: "/user/*",
			Method:      "*",
			RewriteTo:   "/user-service/$1",
			IsActive:    true,
		},
		{
			Name:        "旧版API兼容-有问题",
			Description: "错误的重写规则 - 会导致路径不匹配",
			PathPattern: "/old/*",
			Method:      "*",
			RewriteTo:   "/new-api/$1-wrong",
			IsActive:    true,
		},
	}

	var ruleIDs []string
	for i := range rules {
		err := store.CreateRule(&rules[i])
		if err != nil {
			log.Printf("Failed to create rule: %v", err)
		} else {
			ruleIDs = append(ruleIDs, rules[i].ID)
			log.Printf("Created rule: %s (ID: %s)", rules[i].Name, rules[i].ID)
		}
	}

	samples := []model.SampleRequest{
		{
			Path:         "/api/v1/users",
			Method:       "GET",
			Headers:      storage.ToJSON(map[string]string{"Content-Type": "application/json"}),
			ExpectedPath: "/service/v1/users",
			ExpectedCode: 200,
			Source:       "production-log",
		},
		{
			Path:         "/api/v2/orders",
			Method:       "POST",
			Headers:      storage.ToJSON(map[string]string{"Content-Type": "application/json"}),
			Body:         `{"item": "test"}`,
			ExpectedPath: "/service/v2/orders",
			ExpectedCode: 200,
			Source:       "production-log",
		},
		{
			Path:         "/user/profile",
			Method:       "GET",
			Headers:      storage.ToJSON(map[string]string{"Authorization": "Bearer xxx"}),
			ExpectedPath: "/user-service/profile",
			ExpectedCode: 200,
			Source:       "production-log",
		},
		{
			Path:         "/old/api/data",
			Method:       "GET",
			ExpectedPath: "/new-api/data",
			ExpectedCode: 200,
			Source:       "production-log",
		},
		{
			Path:         "/not-match/path",
			Method:       "GET",
			ExpectedPath: "/not-match/path",
			ExpectedCode: 200,
			Source:       "production-log",
		},
	}

	var sampleIDs []string
	for i := range samples {
		err := store.CreateSampleRequest(&samples[i])
		if err != nil {
			log.Printf("Failed to create sample: %v", err)
		} else {
			sampleIDs = append(sampleIDs, samples[i].ID)
			log.Printf("Created sample: %s %s (ID: %s)", samples[i].Method, samples[i].Path, samples[i].ID)
		}
	}

	ruleIDsJSON, _ := json.Marshal(ruleIDs)
	batch := &model.ShadowBatch{
		Name:    "首次影子测试-全量规则",
		RuleIDs: model.JSON(ruleIDsJSON),
		Status:  "pending",
	}
	err = store.CreateBatch(batch)
	if err != nil {
		log.Printf("Failed to create batch: %v", err)
	} else {
		log.Printf("Created batch: %s (ID: %s)", batch.Name, batch.ID)
	}

	fmt.Println("\n=== 初始化完成 ===")
	fmt.Printf("创建了 %d 条代理规则\n", len(ruleIDs))
	fmt.Printf("创建了 %d 条样本请求\n", len(sampleIDs))
	fmt.Printf("创建了 1 个测试批次\n")
	fmt.Println("\n可执行以下命令开始测试:")
	fmt.Println("curl -X POST http://localhost:8080/api/v1/batches/execute -H 'Content-Type: application/json' -d '{\"batch_id\":\"" + batch.ID + "\"}'")
}
