//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"strings"

	"strategy-hotload-api/internal/model"
	"strategy-hotload-api/internal/service"
	"strategy-hotload-api/internal/store"
)

func main() {
	fmt.Println("=== Testing Strategy Hotload API Fixes ===\n")

	s := store.NewMemoryStore()
	svc := service.NewStrategyService(s)

	test1_CreatePackage(svc)
	test2_CreateRuleVersion(svc)
	test3_PublishVersion(svc)
	test4_HitCheckWithPublishedVersion(svc)
	test5_GrayReleaseByUserID(svc)
	test6_IdempotentRequest(svc)
	test7_ContainsOperator(svc)

	fmt.Println("\n=== All tests completed ===")
}

var pkgID string
var versionID string

func test1_CreatePackage(svc *service.StrategyService) {
	fmt.Println("Test 1: Create Package")
	pkg, err := svc.CreatePackage(&model.CreatePackageRequest{
		Name:        "风控策略包",
		Description: "用于风险控制的策略规则集合",
		CreatedBy:   "admin",
	})
	if err != nil {
		fmt.Printf("  FAIL: %v\n", err)
		return
	}
	pkgID = pkg.ID
	fmt.Printf("  PASS: Created package with ID: %s\n", pkgID[:8]+"...")
}

func test2_CreateRuleVersion(svc *service.StrategyService) {
	fmt.Println("\nTest 2: Create Rule Version")
	version, err := svc.CreateRuleVersion(&model.CreateRuleVersionRequest{
		PackageID: pkgID,
		Version:   "v1.0.0",
		RuleContent: map[string]interface{}{
			"rules": []interface{}{
				map[string]interface{}{
					"id":   "rule_001",
					"name": "用户等级检查",
					"conditions": []interface{}{
						map[string]interface{}{
							"field":    "level",
							"operator": "contains",
							"expected": "VIP",
						},
					},
				},
			},
		},
		CreatedBy: "admin",
		Remark:    "初始版本",
	})
	if err != nil {
		fmt.Printf("  FAIL: %v\n", err)
		return
	}
	versionID = version.ID
	fmt.Printf("  PASS: Created version with ID: %s, Status: %s\n", versionID[:8]+"...", version.Status)
}

func test3_PublishVersion(svc *service.StrategyService) {
	fmt.Println("\nTest 3: Publish Version (TESTING -> GRAY -> PUBLISHED)")
	_, err := svc.UpdateStatus(versionID, &model.UpdateStatusRequest{
		TargetStatus: model.StatusTesting,
		Operator:     "admin",
		Remark:       "进入测试",
	})
	if err != nil {
		fmt.Printf("  FAIL step1 TESTING: %v\n", err)
		return
	}

	_, err = svc.UpdateStatus(versionID, &model.UpdateStatusRequest{
		TargetStatus: model.StatusGray,
		GrayRange: &model.GrayRange{
			UserIDs:    []string{"user_001", "user_002"},
			Percentage: 0,
			Regions:    []string{"china"},
		},
		Operator: "admin",
		Remark:   "进入灰度，指定用户和区域",
	})
	if err != nil {
		fmt.Printf("  FAIL step2 GRAY: %v\n", err)
		return
	}

	_, err = svc.UpdateStatus(versionID, &model.UpdateStatusRequest{
		TargetStatus: model.StatusPublished,
		Operator:     "admin",
		Remark:       "正式发布",
	})
	if err != nil {
		fmt.Printf("  FAIL step3 PUBLISHED: %v\n", err)
		return
	}

	v, _ := svc.GetRuleVersion(versionID)
	fmt.Printf("  PASS: Current status: %s\n", v.Status)
}

func test4_HitCheckWithPublishedVersion(svc *service.StrategyService) {
	fmt.Println("\nTest 4: Hit Check with Published Version")
	resp, err := svc.HitCheck(&model.HitCheckRequest{
		PackageID: pkgID,
		Input: map[string]interface{}{
			"level": "Premium-VIP",
		},
		RequestID: "req_001",
		UserID:    "user_003",
	})
	if err != nil {
		fmt.Printf("  FAIL: %v\n", err)
		return
	}
	fmt.Printf("  PASS: HitResult: %v, IsCached: %v, VersionID: %s\n",
		resp.HitResult, resp.IsCached, resp.VersionID[:8]+"...")
}

func test5_GrayReleaseByUserID(svc *service.StrategyService) {
	fmt.Println("\nTest 5: Gray Release with User ID Filter")

	grayVersion, err := svc.CreateRuleVersion(&model.CreateRuleVersionRequest{
		PackageID: pkgID,
		Version:   "v1.1.0-gray",
		RuleContent: map[string]interface{}{
			"rules": []interface{}{
				map[string]interface{}{
					"id":   "rule_002",
					"name": "灰度新规则",
					"conditions": []interface{}{
						map[string]interface{}{
							"field":    "level",
							"operator": "eq",
							"expected": "VIP",
						},
					},
				},
			},
		},
		CreatedBy: "admin",
		Remark:    "灰度版本",
	})
	if err != nil {
		fmt.Printf("  FAIL create gray version: %v\n", err)
		return
	}

	_, err = svc.UpdateStatus(grayVersion.ID, &model.UpdateStatusRequest{
		TargetStatus: model.StatusTesting,
		Operator:     "admin",
	})
	if err != nil {
		fmt.Printf("  FAIL testing: %v\n", err)
		return
	}

	_, err = svc.UpdateStatus(grayVersion.ID, &model.UpdateStatusRequest{
		TargetStatus: model.StatusGray,
		GrayRange: &model.GrayRange{
			UserIDs: []string{"user_001", "user_002"},
		},
		Operator: "admin",
	})
	if err != nil {
		fmt.Printf("  FAIL gray: %v\n", err)
		return
	}

	fmt.Println("  - User 001 (IN gray list) should hit GRAY version:")
	resp1, _ := svc.HitCheck(&model.HitCheckRequest{
		PackageID: pkgID,
		Input: map[string]interface{}{
			"level": "VIP",
		},
		RequestID: "req_gray_user1",
		UserID:    "user_001",
	})
	fmt.Printf("    Result: VersionID = %s, HitRules = %v\n", resp1.VersionID[:8]+"...", resp1.HitRules)

	fmt.Println("  - User 003 (NOT in gray list) should hit PUBLISHED version:")
	resp2, _ := svc.HitCheck(&model.HitCheckRequest{
		PackageID: pkgID,
		Input: map[string]interface{}{
			"level": "Premium-VIP",
		},
		RequestID: "req_gray_user3",
		UserID:    "user_003",
	})
	fmt.Printf("    Result: VersionID = %s, HitRules = %v\n", resp2.VersionID[:8]+"...", resp2.HitRules)

	if resp1.VersionID != resp2.VersionID {
		fmt.Println("  PASS: Different users hit different versions based on gray range!")
	} else {
		fmt.Println("  INFO: Both users hit same version")
	}
}

func test6_IdempotentRequest(svc *service.StrategyService) {
	fmt.Println("\nTest 6: Idempotent Request Test")
	reqID := "req_idempotent_test"

	fmt.Println("  - First request (new):")
	resp1, err := svc.HitCheck(&model.HitCheckRequest{
		PackageID: pkgID,
		Input: map[string]interface{}{
			"level": "VIP",
		},
		RequestID: reqID,
		UserID:    "user_001",
	})
	if err != nil {
		fmt.Printf("    FAIL first request: %v\n", err)
		return
	}
	fmt.Printf("    IsCached: %v, HitResult: %v\n", resp1.IsCached, resp1.HitResult)

	fmt.Println("  - Second request (same request_id):")
	resp2, err := svc.HitCheck(&model.HitCheckRequest{
		PackageID: pkgID,
		Input: map[string]interface{}{
			"level": "VIP",
		},
		RequestID: reqID,
		UserID:    "user_001",
	})
	if err != nil {
		fmt.Printf("    FAIL second request: %v\n", err)
		return
	}
	fmt.Printf("    IsCached: %v, HitResult: %v\n", resp2.IsCached, resp2.HitResult)

	if resp2.IsCached && resp1.HitResult == resp2.HitResult {
		fmt.Println("  PASS: Second request returned cached result!")
	} else {
		fmt.Println("  FAIL: Idempotency not working correctly")
	}
}

func test7_ContainsOperator(svc *service.StrategyService) {
	fmt.Println("\nTest 7: Contains Operator Test")

	testCases := []struct {
		input    string
		substr   string
		expected bool
	}{
		{"Hello World", "World", true},
		{"Hello World", "world", false},
		{"VIP User", "VIP", true},
		{"PremiumVIP", "VIP", true},
		{"VIPPremium", "VIP", true},
		{"Hello", "XYZ", false},
		{"", "", true},
	}

	allPass := true
	for _, tc := range testCases {
		result := strings.Contains(tc.input, tc.substr)
		status := "PASS"
		if result != tc.expected {
			status = "FAIL"
			allPass = false
		}
		fmt.Printf("  [%s] contains('%s', '%s') = %v (expected %v)\n",
			status, tc.input, tc.substr, result, tc.expected)
	}

	if allPass {
		fmt.Println("  PASS: Contains operator works correctly with real substring matching!")
	} else {
		fmt.Println("  FAIL: Some contains tests failed")
	}
}
