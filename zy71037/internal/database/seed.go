package database

import (
	"database/sql"
	"time"

	"night-market-api/pkg/utils"
)

func SeedTestData() error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var count int
	err = tx.QueryRow(`SELECT COUNT(*) FROM stalls`).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now()

	stalls := []struct {
		id            string
		code          string
		name          string
		powerCapacity int
		hasExhaust    bool
		zone          string
	}{
		{"stall-001", "A01", "A区1号摊位", 5000, true, "A区-餐饮"},
		{"stall-002", "A02", "A区2号摊位", 5000, true, "A区-餐饮"},
		{"stall-003", "A03", "A区3号摊位", 3000, false, "A区-餐饮"},
		{"stall-004", "B01", "B区1号摊位", 2000, false, "B区-百货"},
		{"stall-005", "B02", "B区2号摊位", 2000, false, "B区-百货"},
		{"stall-006", "C01", "C区1号摊位", 8000, true, "C区-重餐饮"},
		{"stall-007", "C02", "C区2号摊位", 6000, true, "C区-重餐饮"},
		{"stall-008", "C03", "C区3号摊位", 6000, true, "C区-重餐饮"},
	}

	for _, s := range stalls {
		_, err = tx.Exec(
			`INSERT INTO stalls (id, code, name, power_capacity, has_exhaust, zone, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
			s.id, s.code, s.name, s.powerCapacity, s.hasExhaust, s.zone, now, now,
		)
		if err != nil {
			return err
		}
	}

	vendors := []struct {
		id              string
		name            string
		phone           string
		category        string
		powerUsage      int
		requiresExhaust bool
		score           int
	}{
		{"vendor-001", "老张烧烤", "13800138001", "烧烤", 7000, true, 95},
		{"vendor-002", "小李奶茶", "13800138002", "饮品", 1500, false, 100},
		{"vendor-003", "王记炒饭", "13800138003", "快餐", 4000, true, 85},
		{"vendor-004", "陈记饰品", "13800138004", "饰品", 500, false, 92},
		{"vendor-005", "刘姐麻辣烫", "13800138005", "麻辣烫", 5500, true, 78},
		{"vendor-006", "老孙水果", "13800138006", "水果", 800, false, 88},
		{"vendor-007", "赵家炸串", "13800138007", "炸串", 4500, true, 55},
		{"vendor-008", "周姐手作", "13800138008", "手作", 300, false, 98},
	}

	for _, v := range vendors {
		_, err = tx.Exec(
			`INSERT INTO vendors (id, name, phone, category, power_usage, requires_exhaust, score, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
			v.id, v.name, v.phone, v.category, v.powerUsage, v.requiresExhaust, v.score, now, now,
		)
		if err != nil {
			return err
		}
	}

	complaints := []struct {
		id             string
		vendorID       string
		complaintType  string
		description    string
		severity       string
		pointsDeducted int
		status         string
		reportedBy     string
	}{
		{utils.GenerateID(), "vendor-005", "油烟超标", "多次被邻居投诉油烟过大", "moderate", 10, "resolved", "巡查员A"},
		{utils.GenerateID(), "vendor-007", "卫生问题", "摊位前垃圾未及时清理", "minor", 5, "resolved", "巡查员B"},
		{utils.GenerateID(), "vendor-007", "占道经营", "超出划定区域经营", "severe", 20, "pending", "巡查员A"},
		{utils.GenerateID(), "vendor-001", "顾客投诉", "等待时间过长态度不好", "trivial", 2, "pending", "顾客投诉"},
	}

	for _, c := range complaints {
		resolvedAt := sql.NullTime{}
		if c.status == "resolved" {
			resolvedAt = sql.NullTime{Time: now, Valid: true}
		}
		_, err = tx.Exec(
			`INSERT INTO complaints (id, vendor_id, type, description, severity, points_deducted, status, reported_by, reported_at, resolved_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.id, c.vendorID, c.complaintType, c.description, c.severity, c.pointsDeducted, c.status, c.reportedBy, now, resolvedAt,
		)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(`UPDATE vendors SET score = score - 10 WHERE id = 'vendor-005'`)
	if err != nil {
		return err
	}
	_, err = tx.Exec(`UPDATE vendors SET score = score - 5 WHERE id = 'vendor-007'`)
	if err != nil {
		return err
	}

	return tx.Commit()
}
