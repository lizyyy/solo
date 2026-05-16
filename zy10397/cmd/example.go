package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const baseURL = "http://localhost:8081/api/v1"

type File struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

type Issuer struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Link struct {
	ID           string    `json:"id"`
	Token        string    `json:"token"`
	FileID       string    `json:"file_id"`
	IssuerID     string    `json:"issuer_id"`
	ExpiresAt    time.Time `json:"expires_at"`
	MaxAccess    int       `json:"max_access"`
	AccessCount  int       `json:"access_count"`
	Status       string    `json:"status"`
	RevokeReason string    `json:"revoke_reason"`
	RevokedBy    string    `json:"revoked_by"`
}

func postRequest(url string, data interface{}, result interface{}) error {
	jsonData, _ := json.Marshal(data)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return json.Unmarshal(body, result)
}

func getRequest(url string, result interface{}) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return json.Unmarshal(body, result)
}

func main() {
	fmt.Println("=== 预签名链接治理 API 示例 ===")
	fmt.Println()

	fmt.Println("1. 创建文件对象...")
	file := File{Name: "example.pdf", Path: "/docs/example.pdf"}
	var createdFile File
	if err := postRequest(baseURL+"/files", file, &createdFile); err != nil {
		fmt.Println("创建文件失败:", err)
		return
	}
	fmt.Printf("文件创建成功: ID=%s, Name=%s\n", createdFile.ID, createdFile.Name)
	fmt.Println()

	fmt.Println("2. 创建签发人...")
	issuer := Issuer{Name: "张三", Email: "zhangsan@example.com"}
	var createdIssuer Issuer
	if err := postRequest(baseURL+"/issuers", issuer, &createdIssuer); err != nil {
		fmt.Println("创建签发人失败:", err)
		return
	}
	fmt.Printf("签发人创建成功: ID=%s, Name=%s\n", createdIssuer.ID, createdIssuer.Name)
	fmt.Println()

	fmt.Println("3. 创建预签名链接 (有效期1小时, 最大访问3次)...")
	linkReq := map[string]interface{}{
		"file_id":      createdFile.ID,
		"issuer_id":    createdIssuer.ID,
		"expire_hours": 1,
		"max_access":   3,
	}
	var link Link
	if err := postRequest(baseURL+"/links", linkReq, &link); err != nil {
		fmt.Println("创建链接失败:", err)
		return
	}
	fmt.Printf("链接创建成功: Token=%s, MaxAccess=%d\n", link.Token, link.MaxAccess)
	fmt.Println()

	fmt.Println("4. 验证链接 (第1次访问)...")
	var result map[string]interface{}
	if err := getRequest(baseURL+"/access/validate/"+link.Token, &result); err != nil {
		fmt.Println("验证失败:", err)
		return
	}
	fmt.Printf("验证结果: Valid=%v, Status=%s\n", result["valid"], result["status"])
	fmt.Println()

	time.Sleep(100 * time.Millisecond)

	fmt.Println("5. 验证链接 (第2次访问)...")
	if err := getRequest(baseURL+"/access/validate/"+link.Token, &result); err != nil {
		fmt.Println("验证失败:", err)
		return
	}
	fmt.Printf("验证结果: Valid=%v, Status=%s\n", result["valid"], result["status"])
	fmt.Println()

	time.Sleep(100 * time.Millisecond)

	fmt.Println("6. 验证链接 (第3次访问)...")
	if err := getRequest(baseURL+"/access/validate/"+link.Token, &result); err != nil {
		fmt.Println("验证失败:", err)
		return
	}
	fmt.Printf("验证结果: Valid=%v, Status=%s\n", result["valid"], result["status"])
	fmt.Println()

	time.Sleep(100 * time.Millisecond)

	fmt.Println("7. 验证链接 (第4次访问 - 触发次数限制)...")
	if err := getRequest(baseURL+"/access/validate/"+link.Token, &result); err != nil {
		fmt.Println("验证失败:", err)
		return
	}
	fmt.Printf("验证结果: Valid=%v, Status=%s, Reason=%s\n", result["valid"], result["status"], result["fail_reason"])
	fmt.Println()

	fmt.Println("8. 查看访问日志...")
	var logsResult map[string]interface{}
	if err := getRequest(baseURL+"/access/logs?limit=10", &logsResult); err != nil {
		fmt.Println("获取日志失败:", err)
		return
	}
	logsData := logsResult["data"].([]interface{})
	fmt.Printf("总访问记录数: %d\n", int(logsResult["total"].(float64)))
	for i, log := range logsData {
		logMap := log.(map[string]interface{})
		fmt.Printf("  %d. Success=%v, IP=%s, Reason=%s\n",
			i+1, logMap["success"], logMap["client_ip"], logMap["fail_reason"])
	}
	fmt.Println()

	fmt.Println("9. 测试幂等性 - 使用相同 idempotency_key 重复创建...")
	idempotentKey := "test-key-12345"
	linkReq2 := map[string]interface{}{
		"idempotency_key": idempotentKey,
		"file_id":         createdFile.ID,
		"issuer_id":       createdIssuer.ID,
		"expire_hours":    2,
		"max_access":      5,
	}
	var link1, link2 Link
	if err := postRequest(baseURL+"/links", linkReq2, &link1); err != nil {
		fmt.Println("第一次创建失败:", err)
		return
	}
	if err := postRequest(baseURL+"/links", linkReq2, &link2); err != nil {
		fmt.Println("第二次创建失败:", err)
		return
	}
	fmt.Printf("第一次链接ID: %s\n", link1.ID)
	fmt.Printf("第二次链接ID: %s (相同说明幂等性生效)\n", link2.ID)
	fmt.Printf("是否相同: %v\n", link1.ID == link2.ID)
	fmt.Println()

	fmt.Println("10. 撤销链接...")
	revokeReq := map[string]string{
		"reason":     "文件已过期",
		"revoked_by": "admin",
	}
	var revokedLink Link
	if err := postRequest(fmt.Sprintf("%s/links/%s/revoke", baseURL, link1.ID), revokeReq, &revokedLink); err != nil {
		fmt.Println("撤销失败:", err)
		return
	}
	fmt.Printf("链接状态: %s, 撤销原因: %s\n", revokedLink.Status, revokedLink.RevokeReason)
	fmt.Println()

	fmt.Println("=== 示例执行完成 ===")
}
