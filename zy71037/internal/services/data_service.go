package services

import (
	"database/sql"
	"errors"
	"time"

	"night-market-api/internal/database"
	"night-market-api/internal/models"
	"night-market-api/pkg/utils"
)

type DataService struct{}

func NewDataService() *DataService {
	return &DataService{}
}

func (s *DataService) CreateStall(code, name string, powerCapacity int, hasExhaust bool, zone string) (*models.Stall, error) {
	id := utils.GenerateID()
	now := time.Now()

	_, err := database.DB.Exec(
		`INSERT INTO stalls (id, code, name, power_capacity, has_exhaust, zone, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
		id, code, name, powerCapacity, hasExhaust, zone, now, now,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("stall", id, "create", "", "active", "system")

	return s.GetStall(id)
}

func (s *DataService) GetStall(id string) (*models.Stall, error) {
	var st models.Stall
	err := database.DB.QueryRow(
		`SELECT id, code, name, power_capacity, has_exhaust, zone, status, created_at, updated_at
		 FROM stalls WHERE id = ?`, id,
	).Scan(&st.ID, &st.Code, &st.Name, &st.PowerCapacity, &st.HasExhaust, &st.Zone, &st.Status, &st.CreatedAt, &st.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *DataService) GetStallByCode(code string) (*models.Stall, error) {
	var st models.Stall
	err := database.DB.QueryRow(
		`SELECT id, code, name, power_capacity, has_exhaust, zone, status, created_at, updated_at
		 FROM stalls WHERE code = ?`, code,
	).Scan(&st.ID, &st.Code, &st.Name, &st.PowerCapacity, &st.HasExhaust, &st.Zone, &st.Status, &st.CreatedAt, &st.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *DataService) ListStalls() ([]models.Stall, error) {
	rows, err := database.DB.Query(
		`SELECT id, code, name, power_capacity, has_exhaust, zone, status, created_at, updated_at
		 FROM stalls ORDER BY code`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stalls []models.Stall
	for rows.Next() {
		var st models.Stall
		err := rows.Scan(&st.ID, &st.Code, &st.Name, &st.PowerCapacity, &st.HasExhaust, &st.Zone, &st.Status, &st.CreatedAt, &st.UpdatedAt)
		if err != nil {
			return nil, err
		}
		stalls = append(stalls, st)
	}
	return stalls, nil
}

func (s *DataService) UpdateStall(id string, name *string, powerCapacity *int, hasExhaust *bool, zone *string, status *string) (*models.Stall, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var oldStall models.Stall
	err = tx.QueryRow(
		`SELECT name, power_capacity, has_exhaust, zone, status FROM stalls WHERE id = ?`, id,
	).Scan(&oldStall.Name, &oldStall.PowerCapacity, &oldStall.HasExhaust, &oldStall.Zone, &oldStall.Status)
	if err == sql.ErrNoRows {
		return nil, errors.New("摊位不存在")
	}
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if name != nil {
		_, err = tx.Exec(`UPDATE stalls SET name = ?, updated_at = ? WHERE id = ?`, *name, now, id)
		if err != nil {
			return nil, err
		}
		_ = database.AuditLog("stall", id, "update_name", oldStall.Name, *name, "system")
	}
	if powerCapacity != nil {
		_, err = tx.Exec(`UPDATE stalls SET power_capacity = ?, updated_at = ? WHERE id = ?`, *powerCapacity, now, id)
		if err != nil {
			return nil, err
		}
	}
	if hasExhaust != nil {
		_, err = tx.Exec(`UPDATE stalls SET has_exhaust = ?, updated_at = ? WHERE id = ?`, *hasExhaust, now, id)
		if err != nil {
			return nil, err
		}
	}
	if zone != nil {
		_, err = tx.Exec(`UPDATE stalls SET zone = ?, updated_at = ? WHERE id = ?`, *zone, now, id)
		if err != nil {
			return nil, err
		}
	}
	if status != nil {
		_, err = tx.Exec(`UPDATE stalls SET status = ?, updated_at = ? WHERE id = ?`, *status, now, id)
		if err != nil {
			return nil, err
		}
		_ = database.AuditLog("stall", id, "update_status", oldStall.Status, *status, "system")
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetStall(id)
}

func (s *DataService) CreateVendor(name, phone, category string, powerUsage int, requiresExhaust bool) (*models.Vendor, error) {
	id := utils.GenerateID()
	now := time.Now()

	_, err := database.DB.Exec(
		`INSERT INTO vendors (id, name, phone, category, power_usage, requires_exhaust, score, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 100, 'active', ?, ?)`,
		id, name, phone, category, powerUsage, requiresExhaust, now, now,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("vendor", id, "create", "", "active", "system")

	return s.GetVendor(id)
}

func (s *DataService) GetVendor(id string) (*models.Vendor, error) {
	var v models.Vendor
	err := database.DB.QueryRow(
		`SELECT id, name, phone, category, power_usage, requires_exhaust, score, status, created_at, updated_at
		 FROM vendors WHERE id = ?`, id,
	).Scan(&v.ID, &v.Name, &v.Phone, &v.Category, &v.PowerUsage, &v.RequiresExhaust, &v.Score, &v.Status, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (s *DataService) ListVendors() ([]models.Vendor, error) {
	rows, err := database.DB.Query(
		`SELECT id, name, phone, category, power_usage, requires_exhaust, score, status, created_at, updated_at
		 FROM vendors ORDER BY name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vendors []models.Vendor
	for rows.Next() {
		var v models.Vendor
		err := rows.Scan(&v.ID, &v.Name, &v.Phone, &v.Category, &v.PowerUsage, &v.RequiresExhaust, &v.Score, &v.Status, &v.CreatedAt, &v.UpdatedAt)
		if err != nil {
			return nil, err
		}
		vendors = append(vendors, v)
	}
	return vendors, nil
}

func (s *DataService) UpdateVendor(id string, name, phone, category *string, powerUsage *int, requiresExhaust *bool, status *string) (*models.Vendor, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var oldVendor models.Vendor
	err = tx.QueryRow(
		`SELECT name, phone, category, power_usage, requires_exhaust, status FROM vendors WHERE id = ?`, id,
	).Scan(&oldVendor.Name, &oldVendor.Phone, &oldVendor.Category, &oldVendor.PowerUsage, &oldVendor.RequiresExhaust, &oldVendor.Status)
	if err == sql.ErrNoRows {
		return nil, errors.New("摊主不存在")
	}
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if name != nil {
		_, err = tx.Exec(`UPDATE vendors SET name = ?, updated_at = ? WHERE id = ?`, *name, now, id)
		if err != nil {
			return nil, err
		}
	}
	if phone != nil {
		_, err = tx.Exec(`UPDATE vendors SET phone = ?, updated_at = ? WHERE id = ?`, *phone, now, id)
		if err != nil {
			return nil, err
		}
	}
	if category != nil {
		_, err = tx.Exec(`UPDATE vendors SET category = ?, updated_at = ? WHERE id = ?`, *category, now, id)
		if err != nil {
			return nil, err
		}
	}
	if powerUsage != nil {
		_, err = tx.Exec(`UPDATE vendors SET power_usage = ?, updated_at = ? WHERE id = ?`, *powerUsage, now, id)
		if err != nil {
			return nil, err
		}
	}
	if requiresExhaust != nil {
		_, err = tx.Exec(`UPDATE vendors SET requires_exhaust = ?, updated_at = ? WHERE id = ?`, *requiresExhaust, now, id)
		if err != nil {
			return nil, err
		}
	}
	if status != nil {
		_, err = tx.Exec(`UPDATE vendors SET status = ?, updated_at = ? WHERE id = ?`, *status, now, id)
		if err != nil {
			return nil, err
		}
		_ = database.AuditLog("vendor", id, "update_status", oldVendor.Status, *status, "system")
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetVendor(id)
}

func (s *DataService) GetAuditLogs(entityType, entityID string) ([]models.AuditLog, error) {
	query := `SELECT id, entity_type, entity_id, action, old_value, new_value, operator, created_at 
	          FROM audit_logs WHERE 1=1`
	var args []interface{}

	if entityType != "" {
		query += " AND entity_type = ?"
		args = append(args, entityType)
	}
	if entityID != "" {
		query += " AND entity_id = ?"
		args = append(args, entityID)
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		err := rows.Scan(&l.ID, &l.EntityType, &l.EntityID, &l.Action, &l.OldValue, &l.NewValue, &l.Operator, &l.CreatedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}
