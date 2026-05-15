package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"longpoll-session-api/internal/model"
	"net/http"
	"time"
)

func main() {
	fmt.Println("=== 测试修复功能 ===")

	fmt.Println("\n1. 测试幂等性功能...")
	testIdempotency()

	fmt.Println("\n2. 测试重连功能...")
	testReconnect()

	fmt.Println("\n=== 测试完成 ===")
}

func testIdempotency() {
	key := "test-idempotency-key-12345"

	req1 := model.CreateSessionRequest{
		ClientID:       "client-001",
		IdempotencyKey: key,
	}
	resp1, err := createSession(req1)
	if err != nil {
		fmt.Printf("  第一次创建失败: %v\n", err)
		return
	}
	fmt.Printf("  第一次创建会话 ID: %s (Created: %v)\n", resp1.SessionID, resp1.Created)

	req2 := model.CreateSessionRequest{
		ClientID:       "client-001",
		IdempotencyKey: key,
	}
	resp2, err := createSession(req2)
	if err != nil {
		fmt.Printf("  第二次创建失败: %v\n", err)
		return
	}
	fmt.Printf("  第二次创建会话 ID: %s (Created: %v)\n", resp2.SessionID, resp2.Created)

	if resp1.SessionID == resp2.SessionID && !resp2.Created {
		fmt.Println("  ✓ 幂等性功能正常：相同key返回相同会话")
	} else {
		fmt.Println("  ✗ 幂等性功能异常")
	}
}

func testReconnect() {
	req := model.CreateSessionRequest{
		ClientID: "client-002",
	}
	resp, err := createSession(req)
	if err != nil {
		fmt.Printf("  创建会话失败: %v\n", err)
		return
	}
	sessionID := resp.SessionID
	fmt.Printf("  创建会话 ID: %s, ReconnectCount: %d\n", sessionID, resp.Session.ReconnectCount)

	reconnectReq := model.ReconnectRequest{
		SessionID: sessionID,
		ClientID:  "client-002",
	}
	reconnectResp, err := reconnectSession(reconnectReq)
	if err != nil {
		fmt.Printf("  重连失败: %v\n", err)
		return
	}
	fmt.Printf("  重连后 ReconnectCount: %d, Status: %s\n", reconnectResp.Session.ReconnectCount, reconnectResp.Session.Status)

	if reconnectResp.Session.ReconnectCount == 1 && reconnectResp.Session.Status == model.SessionStatusActive {
		fmt.Println("  ✓ 重连功能正常")
	} else {
		fmt.Println("  ✗ 重连功能异常")
	}
}

func createSession(req model.CreateSessionRequest) (*model.CreateSessionResponse, error) {
	body, _ := json.Marshal(req)
	resp, err := http.Post("http://localhost:8080/api/sessions", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result model.CreateSessionResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func reconnectSession(req model.ReconnectRequest) (*model.ReconnectResponse, error) {
	body, _ := json.Marshal(req)
	resp, err := http.Post("http://localhost:8080/api/sessions/reconnect", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result model.ReconnectResponse
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}
