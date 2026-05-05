package scanner

import (
	"fmt"
	"log"
	"path/filepath"

	"go-quality-scanner/internal/config"
	"go-quality-scanner/internal/database"
	"go-quality-scanner/internal/models"
)

// ScanService 扫描服务
type ScanService struct {
	goModScanner  *GoModScanner
	sourceScanner *SourceScanner
}

// NewScanService 创建新的扫描服务
func NewScanService(rules *config.RulesConfig) *ScanService {
	return &ScanService{
		goModScanner:  NewGoModScanner(),
		sourceScanner: NewSourceScanner(rules),
	}
}

// ScanProject 扫描项目
func (s *ScanService) ScanProject(projectName, projectPath string) (*models.ScanRecord, error) {
	// 创建扫描记录
	scanRecord := &models.ScanRecord{
		ProjectName: projectName,
		ProjectPath: projectPath,
		Status:      "running",
	}
	
	db := database.GetDB()
	if err := db.Create(scanRecord).Error; err != nil {
		return nil, fmt.Errorf("failed to create scan record: %w", err)
	}
	
	// 执行扫描
	go func(record *models.ScanRecord) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Scan panicked: %v", r)
				record.Status = "failed"
				record.ErrorMsg = fmt.Sprintf("Scan panicked: %v", r)
				db.Save(record)
			}
		}()
		
		// 检查 go.mod
		goModPath := filepath.Join(projectPath, "go.mod")
		record.GoModPath = goModPath
		
		// 扫描 go.mod
		goModInfo, err := s.goModScanner.Scan(projectPath)
		if err != nil {
			log.Printf("Failed to scan go.mod: %v", err)
			record.Status = "failed"
			record.ErrorMsg = fmt.Sprintf("Failed to scan go.mod: %v", err)
			db.Save(record)
			return
		}
		
		// 扫描源码
		sourceResult, err := s.sourceScanner.Scan(projectPath)
		if err != nil {
			log.Printf("Failed to scan source: %v", err)
			record.Status = "failed"
			record.ErrorMsg = fmt.Sprintf("Failed to scan source: %v", err)
			db.Save(record)
			return
		}
		
		// 创建扫描结果
		scanResult := &models.ScanResult{
			ScanRecordID: record.ID,
		}
		if err := db.Create(scanResult).Error; err != nil {
			log.Printf("Failed to create scan result: %v", err)
			record.Status = "failed"
			record.ErrorMsg = fmt.Sprintf("Failed to create scan result: %v", err)
			db.Save(record)
			return
		}
		
		// 保存 go.mod 信息
		if goModInfo != nil {
			goModInfo.ScanResultID = scanResult.ID
			if err := db.Create(goModInfo).Error; err != nil {
				log.Printf("Failed to save go.mod info: %v", err)
			}
			
			// 保存依赖
			for _, dep := range goModInfo.Dependencies {
				dep.GoModInfoID = goModInfo.ID
				if err := db.Create(dep).Error; err != nil {
					log.Printf("Failed to save dependency: %v", err)
				}
			}
		}
		
		// 保存问题
		for _, issue := range sourceResult.Issues {
			issue.ScanResultID = scanResult.ID
			if err := db.Create(issue).Error; err != nil {
				log.Printf("Failed to save issue: %v", err)
			}
		}
		
		// 更新扫描记录状态
		record.Status = "completed"
		db.Save(record)
		
		log.Printf("Scan completed for project: %s", projectName)
	}(scanRecord)
	
	return scanRecord, nil
}

// GetScanRecord 获取扫描记录
func (s *ScanService) GetScanRecord(id uint) (*models.ScanRecord, error) {
	db := database.GetDB()
	
	var record models.ScanRecord
	if err := db.First(&record, id).Error; err != nil {
		return nil, fmt.Errorf("scan record not found: %w", err)
	}
	
	// 加载扫描结果
	var scanResult models.ScanResult
	if err := db.Where("scan_record_id = ?", record.ID).First(&scanResult).Error; err == nil {
		record.ScanResult = &scanResult
		
		// 加载问题
		var issues []*models.Issue
		if err := db.Where("scan_result_id = ?", scanResult.ID).Find(&issues).Error; err == nil {
			scanResult.Issues = issues
		}
		
		// 加载 go.mod 信息
		var goModInfo models.GoModInfo
		if err := db.Where("scan_result_id = ?", scanResult.ID).First(&goModInfo).Error; err == nil {
			scanResult.GoModInfo = &goModInfo
			
			// 加载依赖
			var deps []*models.Dependency
			if err := db.Where("go_mod_info_id = ?", goModInfo.ID).Find(&deps).Error; err == nil {
				goModInfo.Dependencies = deps
			}
		}
		
		// 计算摘要
		scanResult.Summary = calculateSummary(issues, scanResult)
	}
	
	return &record, nil
}

// GetAllScanRecords 获取所有扫描记录
func (s *ScanService) GetAllScanRecords() ([]*models.ScanRecord, error) {
	db := database.GetDB()
	
	var records []*models.ScanRecord
	if err := db.Order("created_at DESC").Find(&records).Error; err != nil {
		return nil, fmt.Errorf("failed to get scan records: %w", err)
	}
	
	return records, nil
}

// MarkFalsePositive 标记误报
func (s *ScanService) MarkFalsePositive(issueID uint, reason string) (*models.Issue, error) {
	db := database.GetDB()
	
	var issue models.Issue
	if err := db.First(&issue, issueID).Error; err != nil {
		return nil, fmt.Errorf("issue not found: %w", err)
	}
	
	issue.IsFalsePositive = true
	issue.FalsePositiveReason = reason
	
	if err := db.Save(&issue).Error; err != nil {
		return nil, fmt.Errorf("failed to mark false positive: %w", err)
	}
	
	return &issue, nil
}

// ResolveIssue 解决问题
func (s *ScanService) ResolveIssue(issueID uint) (*models.Issue, error) {
	db := database.GetDB()
	
	var issue models.Issue
	if err := db.First(&issue, issueID).Error; err != nil {
		return nil, fmt.Errorf("issue not found: %w", err)
	}
	
	now := db.NowFunc()
	issue.Resolved = true
	issue.ResolvedAt = &now
	
	if err := db.Save(&issue).Error; err != nil {
		return nil, fmt.Errorf("failed to resolve issue: %w", err)
	}
	
	return &issue, nil
}

// calculateSummary 计算扫描摘要
func calculateSummary(issues []*models.Issue, scanResult *models.ScanResult) *models.ScanSummary {
	summary := &models.ScanSummary{}
	
	for _, issue := range issues {
		summary.TotalIssues++
		
		if issue.IsFalsePositive {
			summary.FalsePositives++
			continue
		}
		
		if issue.Resolved {
			summary.ResolvedIssues++
			continue
		}
		
		switch issue.Severity {
		case "critical":
			summary.CriticalIssues++
		case "high":
			summary.HighIssues++
		case "medium":
			summary.MediumIssues++
		case "low":
			summary.LowIssues++
		}
	}
	
	return summary
}
