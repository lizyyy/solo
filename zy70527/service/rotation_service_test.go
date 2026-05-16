package service

import (
	"cert-rotation/model"
	"cert-rotation/repository"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func setupTestDB() {
	repository.InitDB(":memory:")
}

func TestCreateRotation(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	t.Run("正常创建轮换", func(t *testing.T) {
		req := &CreateRotationRequest{
			TenantID:        "tenant-001",
			OldCertContent:  "-----BEGIN CERTIFICATE-----\nold-cert-data\n-----END CERTIFICATE-----",
			NewCertContent:  "-----BEGIN CERTIFICATE-----\nnew-cert-data\n-----END CERTIFICATE-----",
			WindowStartTime: time.Now(),
			WindowEndTime:   time.Now().Add(24 * time.Hour),
		}

		rotation, err := service.CreateRotation(req)
		assert.NoError(t, err)
		assert.NotNil(t, rotation)
		assert.Equal(t, model.StatusCreated, rotation.Status)
		assert.Equal(t, "tenant-001", rotation.TenantID)
	})

	t.Run("脏数据 - 时间窗口无效", func(t *testing.T) {
		req := &CreateRotationRequest{
			TenantID:        "tenant-002",
			OldCertContent:  "old-cert",
			NewCertContent:  "new-cert",
			WindowStartTime: time.Now().Add(24 * time.Hour),
			WindowEndTime:   time.Now(),
		}

		rotation, err := service.CreateRotation(req)
		assert.Error(t, err)
		assert.Nil(t, rotation)
		assert.Contains(t, err.Error(), "window end time must be after start time")
	})

	t.Run("重复请求 - 相同证书对已存在", func(t *testing.T) {
		req := &CreateRotationRequest{
			TenantID:        "tenant-003",
			OldCertContent:  "duplicate-old",
			NewCertContent:  "duplicate-new",
			WindowStartTime: time.Now(),
			WindowEndTime:   time.Now().Add(24 * time.Hour),
		}

		_, err := service.CreateRotation(req)
		assert.NoError(t, err)

		_, err = service.CreateRotation(req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "active rotation already exists")
	})
}

func TestStartParallelValidation(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-004",
		OldCertContent:  "cert-old-004",
		NewCertContent:  "cert-new-004",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})

	t.Run("正常启动并行验证", func(t *testing.T) {
		err := service.StartParallelValidation(rotation.ID)
		assert.NoError(t, err)

		updated, _ := service.GetRotation(rotation.ID)
		assert.True(t, updated.ParallelEnabled)
		assert.Equal(t, model.StatusParallel, updated.Status)
	})

	t.Run("状态错误 - 非CREATED状态无法启动", func(t *testing.T) {
		err := service.StartParallelValidation(rotation.ID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid status transition")
	})
}

func TestValidationAndStatusAdvance(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-005",
		OldCertContent:  "cert-old-005",
		NewCertContent:  "cert-new-005",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})
	service.StartParallelValidation(rotation.ID)

	t.Run("记录验证样本", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			err := service.RecordValidationSample(
				rotation.ID,
				"OLD",
				"/api/data",
				"192.168.1.100",
				"Go-http-client/1.1",
				"GET /api/data HTTP/1.1",
				true,
				"",
			)
			assert.NoError(t, err)

			err = service.RecordValidationSample(
				rotation.ID,
				"NEW",
				"/api/data",
				"192.168.1.101",
				"Go-http-client/1.1",
				"GET /api/data HTTP/1.1",
				true,
				"",
			)
			assert.NoError(t, err)
		}
	})

	t.Run("正常状态推进到VALIDATING", func(t *testing.T) {
		err := service.AdvanceStatus(rotation.ID, model.StatusValidating)
		assert.NoError(t, err)

		updated, _ := service.GetRotation(rotation.ID)
		assert.Equal(t, model.StatusValidating, updated.Status)
	})

	t.Run("正常状态推进到SWITCHING", func(t *testing.T) {
		err := service.AdvanceStatus(rotation.ID, model.StatusSwitching)
		assert.NoError(t, err)

		updated, _ := service.GetRotation(rotation.ID)
		assert.Equal(t, model.StatusSwitching, updated.Status)
	})

	t.Run("完成切换", func(t *testing.T) {
		receipt, err := service.CompleteSwitch(rotation.ID)
		assert.NoError(t, err)
		assert.NotNil(t, receipt)
		assert.Equal(t, 100, receipt.OldCertCount)
		assert.Equal(t, 100, receipt.NewCertCount)
		assert.True(t, receipt.SuccessRate > 0.95)

		updated, _ := service.GetRotation(rotation.ID)
		assert.Equal(t, model.StatusCompleted, updated.Status)
	})
}

func TestExceptionAndManualFix(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-006",
		OldCertContent:  "cert-old-006",
		NewCertContent:  "cert-new-006",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})

	t.Run("异常处理", func(t *testing.T) {
		err := service.HandleException(rotation.ID, "证书验证失败 - 未知CA", "{\"cert\": \"invalid-data\"}")
		assert.NoError(t, err)

		updated, _ := service.GetRotation(rotation.ID)
		assert.Equal(t, model.StatusManualFix, updated.Status)
	})

	t.Run("人工修正并重新计算", func(t *testing.T) {
		err := service.ApplyManualFix(&ManualFixRequest{
			RotationID: rotation.ID,
			FixNotes:   "已更新CA证书链，重新启动验证流程",
			FixedBy:    "admin@company.com",
			NewStatus:  string(model.StatusParallel),
		})
		assert.NoError(t, err)

		updated, _ := service.GetRotation(rotation.ID)
		assert.Equal(t, model.StatusParallel, updated.Status)
	})
}

func TestReportGenerationAndExport(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-007",
		OldCertContent:  "cert-old-007",
		NewCertContent:  "cert-new-007",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})
	service.StartParallelValidation(rotation.ID)

	for i := 0; i < 150; i++ {
		service.RecordValidationSample(rotation.ID, "OLD", "/api", "1.1.1.1", "test", "", true, "")
		service.RecordValidationSample(rotation.ID, "NEW", "/api", "1.1.1.1", "test", "", true, "")
	}

	t.Run("生成报告", func(t *testing.T) {
		report, err := service.GenerateReport(rotation.ID, "system")
		assert.NoError(t, err)
		assert.NotNil(t, report)
		assert.Equal(t, "SUCCESS", report.Conclusion)
		assert.Equal(t, 150, report.TotalOldSamples)
		assert.Equal(t, 150, report.TotalNewSamples)
		assert.True(t, report.OldCertSuccessRate >= 0.99)
		assert.True(t, report.NewCertSuccessRate >= 0.99)
	})

	t.Run("导出报告", func(t *testing.T) {
		content, err := service.ExportReport(rotation.ID)
		assert.NoError(t, err)
		assert.NotEmpty(t, content)
		assert.Contains(t, content, "rotation_id")
		assert.Contains(t, content, "tenant_id")
		assert.Contains(t, content, "reports")
	})
}

func TestInsufficientSamplesValidation(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-008",
		OldCertContent:  "cert-old-008",
		NewCertContent:  "cert-new-008",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})
	service.StartParallelValidation(rotation.ID)

	for i := 0; i < 10; i++ {
		service.RecordValidationSample(rotation.ID, "OLD", "/api", "1.1.1.1", "test", "", true, "")
	}

	t.Run("样本不足无法推进状态", func(t *testing.T) {
		err := service.AdvanceStatus(rotation.ID, model.StatusValidating)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient validation samples")
	})
}

func TestLowSuccessRateValidation(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-009",
		OldCertContent:  "cert-old-009",
		NewCertContent:  "cert-new-009",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})
	service.StartParallelValidation(rotation.ID)

	for i := 0; i < 100; i++ {
		success := i < 80
		service.RecordValidationSample(rotation.ID, "OLD", "/api", "1.1.1.1", "test", "", success, "")
		service.RecordValidationSample(rotation.ID, "NEW", "/api", "1.1.1.1", "test", "", true, "")
	}

	t.Run("成功率过低无法推进状态", func(t *testing.T) {
		err := service.AdvanceStatus(rotation.ID, model.StatusValidating)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "success rate too low")
	})
}

func TestGetValidationSamples(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-010",
		OldCertContent:  "cert-old-010",
		NewCertContent:  "cert-new-010",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})
	service.StartParallelValidation(rotation.ID)

	for i := 0; i < 35; i++ {
		service.RecordValidationSample(rotation.ID, "OLD", "/api", "1.1.1.1", "test", "", true, "")
	}

	t.Run("分页查询样本", func(t *testing.T) {
		samples, total, err := service.GetValidationSamples(rotation.ID, 1, 10)
		assert.NoError(t, err)
		assert.Equal(t, int64(35), total)
		assert.Len(t, samples, 10)
	})

	t.Run("第二页查询", func(t *testing.T) {
		samples, total, err := service.GetValidationSamples(rotation.ID, 4, 10)
		assert.NoError(t, err)
		assert.Equal(t, int64(35), total)
		assert.Len(t, samples, 5)
	})
}

func TestInvalidStatusTransition(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-011",
		OldCertContent:  "cert-old-011",
		NewCertContent:  "cert-new-011",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})

	t.Run("直接跳转到COMPLETED是非法的", func(t *testing.T) {
		err := service.AdvanceStatus(rotation.ID, model.StatusCompleted)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid status transition")
	})
}

func TestManualFixWrongStatus(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	rotation, _ := service.CreateRotation(&CreateRotationRequest{
		TenantID:        "tenant-012",
		OldCertContent:  "cert-old-012",
		NewCertContent:  "cert-new-012",
		WindowStartTime: time.Now(),
		WindowEndTime:   time.Now().Add(24 * time.Hour),
	})

	t.Run("非MANUAL_FIX状态无法应用人工修正", func(t *testing.T) {
		err := service.ApplyManualFix(&ManualFixRequest{
			RotationID: rotation.ID,
			FixNotes:   "测试修正",
			FixedBy:    "tester",
		})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not in manual fix status")
	})
}

func TestGetRotationNotFound(t *testing.T) {
	setupTestDB()
	service := NewRotationService()

	t.Run("查询不存在的轮换", func(t *testing.T) {
		_, err := service.GetRotation(uuid.NewString())
		assert.Error(t, err)
	})
}

func TestMain(m *testing.M) {
	code := m.Run()
	os.Exit(code)
}
