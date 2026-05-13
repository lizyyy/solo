package service

import (
	"testing"

	"crl-service/database"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("无法创建测试数据库: %v", err)
	}

	err = db.AutoMigrate(
		&database.CertificateRevocation{},
		&database.DistributionVersion{},
		&database.QueryLog{},
		&database.StatusTransitionLog{},
	)
	if err != nil {
		t.Fatalf("无法迁移测试数据库: %v", err)
	}

	return db
}

func TestRegisterRevocation(t *testing.T) {
	db := setupTestDB(t)
	service := NewCRLService(db)

	t.Run("成功注册吊销", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-001",
			Reason:       database.ReasonKeyCompromise,
		}

		revocation, err := service.RegisterRevocation(req)
		if err != nil {
			t.Errorf("注册吊销失败: %v", err)
		}
		if revocation.SerialNumber != "SN-001" {
			t.Errorf("期望序列号 SN-001，实际 %s", revocation.SerialNumber)
		}
		if revocation.Status != database.StatusRegistered {
			t.Errorf("期望状态 REGISTERED，实际 %s", revocation.Status)
		}
	})

	t.Run("重复注册同一证书应返回错误", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-002",
			Reason:       database.ReasonKeyCompromise,
		}

		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Errorf("首次注册失败: %v", err)
		}

		_, err = service.RegisterRevocation(req)
		if err != ErrCertificateAlreadyRevoked {
			t.Errorf("期望错误 ErrCertificateAlreadyRevoked，实际: %v", err)
		}
	})

	t.Run("幂等性测试 - 相同 RequestID 应返回已存在记录", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-003",
			Reason:       database.ReasonKeyCompromise,
			RequestID:    "TEST-REQ-001",
		}

		rev1, err := service.RegisterRevocation(req)
		if err != nil {
			t.Errorf("首次注册失败: %v", err)
		}

		rev2, err := service.RegisterRevocation(req)
		if err != ErrDuplicateRequest {
			t.Errorf("期望错误 ErrDuplicateRequest，实际: %v", err)
		}
		if rev1.ID != rev2.ID {
			t.Errorf("期望相同记录 ID，实际不同: %d vs %d", rev1.ID, rev2.ID)
		}
	})

	t.Run("无效吊销原因应返回错误", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-004",
			Reason:       "INVALID_REASON",
		}

		_, err := service.RegisterRevocation(req)
		if err != ErrInvalidRevocationReason {
			t.Errorf("期望错误 ErrInvalidRevocationReason，实际: %v", err)
		}
	})
}

func TestStatusTransitions(t *testing.T) {
	db := setupTestDB(t)
	service := NewCRLService(db)

	t.Run("状态流转 REGISTERED -> DISTRIBUTED -> CACHE_CONFIRMED -> ACTIVE", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-100",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		_, err = service.CreateDistributionVersion()
		if err != nil {
			t.Fatalf("创建版本失败: %v", err)
		}

		_, err = service.ConfirmCache("SN-100")
		if err != nil {
			t.Fatalf("确认缓存失败: %v", err)
		}

		revocation, err := service.ActivateRevocation("SN-100")
		if err != nil {
			t.Fatalf("激活失败: %v", err)
		}

		if revocation.Status != database.StatusActive {
			t.Errorf("期望状态 ACTIVE，实际 %s", revocation.Status)
		}
	})

	t.Run("不允许的状态跳转 - 直接从 REGISTERED 到 ACTIVE", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-101",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		_, err = service.ActivateRevocation("SN-101")
		if err == nil {
			t.Error("期望状态转换错误，实际成功")
		}
	})

	t.Run("不允许的状态跳转 - 从 DISTRIBUTED 直接到 ACTIVE", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-102",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		_, err = service.CreateDistributionVersion()
		if err != nil {
			t.Fatalf("创建版本失败: %v", err)
		}

		_, err = service.ActivateRevocation("SN-102")
		if err == nil {
			t.Error("期望状态转换错误，实际成功")
		}
	})

	t.Run("确认缓存只能在 DISTRIBUTED 状态", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-103",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		_, err = service.ConfirmCache("SN-103")
		if err == nil {
			t.Error("期望状态转换错误，实际成功")
		}
	})

	t.Run("不存在的证书操作应返回错误", func(t *testing.T) {
		_, err := service.ConfirmCache("NON_EXISTENT")
		if err != ErrCertificateNotFound {
			t.Errorf("期望错误 ErrCertificateNotFound，实际: %v", err)
		}
	})
}

func TestCheckRevocation(t *testing.T) {
	db := setupTestDB(t)
	service := NewCRLService(db)

	t.Run("检查不存在的证书", func(t *testing.T) {
		isRevoked, _, err := service.CheckRevocation("NOT_EXIST", "127.0.0.1", "test-agent")
		if err != nil {
			t.Errorf("检查失败: %v", err)
		}
		if isRevoked {
			t.Error("不存在的证书不应被吊销")
		}
	})

	t.Run("检查已吊销但未激活的证书", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-200",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		isRevoked, _, err := service.CheckRevocation("SN-200", "127.0.0.1", "test-agent")
		if err != nil {
			t.Errorf("检查失败: %v", err)
		}
		if isRevoked {
			t.Error("未激活的证书不应被视为已吊销")
		}
	})

	t.Run("检查已激活的吊销证书", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-201",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		_, err = service.CreateDistributionVersion()
		if err != nil {
			t.Fatalf("创建版本失败: %v", err)
		}

		_, err = service.ConfirmCache("SN-201")
		if err != nil {
			t.Fatalf("确认缓存失败: %v", err)
		}

		_, err = service.ActivateRevocation("SN-201")
		if err != nil {
			t.Fatalf("激活失败: %v", err)
		}

		isRevoked, _, err := service.CheckRevocation("SN-201", "127.0.0.1", "test-agent")
		if err != nil {
			t.Errorf("检查失败: %v", err)
		}
		if !isRevoked {
			t.Error("已激活的吊销证书应被视为已吊销")
		}
	})
}

func TestDistributionVersion(t *testing.T) {
	db := setupTestDB(t)
	service := NewCRLService(db)

	t.Run("创建第一个分发版本", func(t *testing.T) {
		version, err := service.CreateDistributionVersion()
		if err != nil {
			t.Fatalf("创建版本失败: %v", err)
		}
		if version.Version != 1 {
			t.Errorf("期望版本 1，实际 %d", version.Version)
		}
	})

	t.Run("版本号递增", func(t *testing.T) {
		v1, _ := service.CreateDistributionVersion()
		v2, _ := service.CreateDistributionVersion()
		if v2.Version != v1.Version+1 {
			t.Errorf("版本号应递增: %d -> %d", v1.Version, v2.Version)
		}
	})

	t.Run("版本创建时将 REGISTERED 状态的记录推进到 DISTRIBUTED", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			req := RegisterRevocationRequest{
				SerialNumber: string(rune('A' + i)),
				Reason:       database.ReasonKeyCompromise,
			}
			_, err := service.RegisterRevocation(req)
			if err != nil {
				t.Fatalf("注册失败: %v", err)
			}
		}

		version, err := service.CreateDistributionVersion()
		if err != nil {
			t.Fatalf("创建版本失败: %v", err)
		}

		if version.ItemCount != 3 {
			t.Errorf("期望 3 个项目被分发，实际 %d", version.ItemCount)
		}
	})
}

func TestRevocationHistory(t *testing.T) {
	db := setupTestDB(t)
	service := NewCRLService(db)

	t.Run("状态转换历史记录", func(t *testing.T) {
		req := RegisterRevocationRequest{
			SerialNumber: "SN-HISTORY",
			Reason:       database.ReasonKeyCompromise,
		}
		_, err := service.RegisterRevocation(req)
		if err != nil {
			t.Fatalf("注册失败: %v", err)
		}

		_, err = service.CreateDistributionVersion()
		if err != nil {
			t.Fatalf("创建版本失败: %v", err)
		}

		_, err = service.ConfirmCache("SN-HISTORY")
		if err != nil {
			t.Fatalf("确认缓存失败: %v", err)
		}

		history, err := service.GetRevocationHistory("SN-HISTORY")
		if err != nil {
			t.Fatalf("获取历史失败: %v", err)
		}

		if len(history) < 3 {
			t.Errorf("期望至少 3 条历史记录，实际 %d", len(history))
		}
	})
}
