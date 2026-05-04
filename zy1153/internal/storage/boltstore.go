package storage

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	bolt "go.etcd.io/bbolt"
	"github.com/zy1153/pool-diagnostic/internal/models"
)

const (
	BucketPools           = "pools"
	BucketLeases          = "leases"
	BucketQueueItems      = "queue_items"
	BucketQueries         = "queries"
	BucketTransactions    = "transactions"
	BucketTenants         = "tenants"
	BucketAlerts          = "alerts"
	BucketAuditEvents     = "audit_events"
	BucketConfig          = "config"
)

type BoltStore struct {
	db *bolt.DB
}

func NewBoltStore(path string) (*BoltStore, error) {
	db, err := bolt.Open(path, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("failed to open boltdb: %w", err)
	}

	// 初始化所有 bucket
	err = db.Update(func(tx *bolt.Tx) error {
		buckets := []string{
			BucketPools, BucketLeases, BucketQueueItems, BucketQueries,
			BucketTransactions, BucketTenants, BucketAlerts, BucketAuditEvents, BucketConfig,
		}
		for _, bucket := range buckets {
			_, err := tx.CreateBucketIfNotExists([]byte(bucket))
			if err != nil {
				return fmt.Errorf("failed to create bucket %s: %w", bucket, err)
			}
		}
		return nil
	})

	if err != nil {
		db.Close()
		return nil, err
	}

	return &BoltStore{db: db}, nil
}

func (s *BoltStore) Close() error {
	return s.db.Close()
}

// ========== 连接池操作 ==========

func (s *BoltStore) CreatePool(pool *models.ConnectionPool) error {
	if pool.ID == "" {
		pool.ID = uuid.NewString()
	}
	now := time.Now()
	if pool.CreatedAt.IsZero() {
		pool.CreatedAt = now
	}
	pool.UpdatedAt = now

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketPools))
		data, err := json.Marshal(pool)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(pool.ID), data)
	})
}

func (s *BoltStore) GetPool(id string) (*models.ConnectionPool, error) {
	var pool models.ConnectionPool
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketPools))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("pool not found: %s", id)
		}
		return json.Unmarshal(data, &pool)
	})
	if err != nil {
		return nil, err
	}
	return &pool, nil
}

func (s *BoltStore) GetDefaultPool() (*models.ConnectionPool, error) {
	var pools []models.ConnectionPool
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketPools))
		return bucket.ForEach(func(k, v []byte) error {
			var p models.ConnectionPool
			if err := json.Unmarshal(v, &p); err == nil {
				pools = append(pools, p)
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	if len(pools) == 0 {
		return nil, fmt.Errorf("no pool found")
	}
	return &pools[0], nil
}

func (s *BoltStore) UpdatePool(pool *models.ConnectionPool) error {
	pool.UpdatedAt = time.Now()
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketPools))
		data, err := json.Marshal(pool)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(pool.ID), data)
	})
}

// ========== 连接租约操作 ==========

func (s *BoltStore) CreateLease(lease *models.ConnectionLease) error {
	if lease.ID == "" {
		lease.ID = uuid.NewString()
	}

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		data, err := json.Marshal(lease)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(lease.ID), data)
	})
}

func (s *BoltStore) GetLease(id string) (*models.ConnectionLease, error) {
	var lease models.ConnectionLease
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("lease not found: %s", id)
		}
		return json.Unmarshal(data, &lease)
	})
	if err != nil {
		return nil, err
	}
	return &lease, nil
}

func (s *BoltStore) GetLeasesByConnection(connectionID string) ([]models.ConnectionLease, error) {
	var leases []models.ConnectionLease
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		return bucket.ForEach(func(k, v []byte) error {
			var l models.ConnectionLease
			if err := json.Unmarshal(v, &l); err == nil {
				if l.ConnectionID == connectionID {
					leases = append(leases, l)
				}
			}
			return nil
		})
	})
	return leases, err
}

func (s *BoltStore) GetLeasesByRequest(requestID string) ([]models.ConnectionLease, error) {
	var leases []models.ConnectionLease
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		return bucket.ForEach(func(k, v []byte) error {
			var l models.ConnectionLease
			if err := json.Unmarshal(v, &l); err == nil {
				if l.RequestID == requestID {
					leases = append(leases, l)
				}
			}
			return nil
		})
	})
	return leases, err
}

func (s *BoltStore) GetActiveLeases() ([]models.ConnectionLease, error) {
	var leases []models.ConnectionLease
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		return bucket.ForEach(func(k, v []byte) error {
			var l models.ConnectionLease
			if err := json.Unmarshal(v, &l); err == nil {
				if l.Status == models.LeaseStatusBorrowed || l.Status == models.LeaseStatusWaiting || l.Status == models.LeaseStatusSuspicious {
					leases = append(leases, l)
				}
			}
			return nil
		})
	})
	return leases, err
}

func (s *BoltStore) UpdateLease(lease *models.ConnectionLease) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		data, err := json.Marshal(lease)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(lease.ID), data)
	})
}

func (s *BoltStore) GetAllLeases() ([]models.ConnectionLease, error) {
	var leases []models.ConnectionLease
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		return bucket.ForEach(func(k, v []byte) error {
			var l models.ConnectionLease
			if err := json.Unmarshal(v, &l); err == nil {
				leases = append(leases, l)
			}
			return nil
		})
	})
	return leases, err
}

// ========== 等待队列操作 ==========

func (s *BoltStore) CreateQueueItem(item *models.WaitQueueItem) error {
	if item.ID == "" {
		item.ID = uuid.NewString()
	}

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueueItems))
		data, err := json.Marshal(item)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(item.ID), data)
	})
}

func (s *BoltStore) GetQueueItem(id string) (*models.WaitQueueItem, error) {
	var item models.WaitQueueItem
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueueItems))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("queue item not found: %s", id)
		}
		return json.Unmarshal(data, &item)
	})
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *BoltStore) GetActiveQueueItems() ([]models.WaitQueueItem, error) {
	var items []models.WaitQueueItem
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueueItems))
		return bucket.ForEach(func(k, v []byte) error {
			var i models.WaitQueueItem
			if err := json.Unmarshal(v, &i); err == nil {
				if i.Status == models.QueueStatusWaiting {
					items = append(items, i)
				}
			}
			return nil
		})
	})
	return items, err
}

func (s *BoltStore) UpdateQueueItem(item *models.WaitQueueItem) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueueItems))
		data, err := json.Marshal(item)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(item.ID), data)
	})
}

func (s *BoltStore) GetAllQueueItems() ([]models.WaitQueueItem, error) {
	var items []models.WaitQueueItem
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueueItems))
		return bucket.ForEach(func(k, v []byte) error {
			var i models.WaitQueueItem
			if err := json.Unmarshal(v, &i); err == nil {
				items = append(items, i)
			}
			return nil
		})
	})
	return items, err
}

// ========== SQL 查询操作 ==========

func (s *BoltStore) CreateQuery(query *models.SQLQuery) error {
	if query.ID == "" {
		query.ID = uuid.NewString()
	}

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueries))
		data, err := json.Marshal(query)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(query.ID), data)
	})
}

func (s *BoltStore) GetQuery(id string) (*models.SQLQuery, error) {
	var query models.SQLQuery
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueries))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("query not found: %s", id)
		}
		return json.Unmarshal(data, &query)
	})
	if err != nil {
		return nil, err
	}
	return &query, nil
}

func (s *BoltStore) GetSlowQueries(threshold time.Duration) ([]models.SQLQuery, error) {
	var queries []models.SQLQuery
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueries))
		return bucket.ForEach(func(k, v []byte) error {
			var q models.SQLQuery
			if err := json.Unmarshal(v, &q); err == nil {
				if q.Duration > threshold {
					queries = append(queries, q)
				}
			}
			return nil
		})
	})
	return queries, err
}

func (s *BoltStore) GetQueriesByRequest(requestID string) ([]models.SQLQuery, error) {
	var queries []models.SQLQuery
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueries))
		return bucket.ForEach(func(k, v []byte) error {
			var q models.SQLQuery
			if err := json.Unmarshal(v, &q); err == nil {
				if q.RequestID == requestID {
					queries = append(queries, q)
				}
			}
			return nil
		})
	})
	return queries, err
}

func (s *BoltStore) GetAllQueries() ([]models.SQLQuery, error) {
	var queries []models.SQLQuery
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketQueries))
		return bucket.ForEach(func(k, v []byte) error {
			var q models.SQLQuery
			if err := json.Unmarshal(v, &q); err == nil {
				queries = append(queries, q)
			}
			return nil
		})
	})
	return queries, err
}

// ========== 事务操作 ==========

func (s *BoltStore) CreateTransaction(tx *models.Transaction) error {
	if tx.ID == "" {
		tx.ID = uuid.NewString()
	}

	return s.db.Update(func(boltTx *bolt.Tx) error {
		bucket := boltTx.Bucket([]byte(BucketTransactions))
		data, err := json.Marshal(tx)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(tx.ID), data)
	})
}

func (s *BoltStore) GetTransaction(id string) (*models.Transaction, error) {
	var tx models.Transaction
	err := s.db.View(func(boltTx *bolt.Tx) error {
		bucket := boltTx.Bucket([]byte(BucketTransactions))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("transaction not found: %s", id)
		}
		return json.Unmarshal(data, &tx)
	})
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (s *BoltStore) GetActiveTransactions() ([]models.Transaction, error) {
	var txs []models.Transaction
	err := s.db.View(func(boltTx *bolt.Tx) error {
		bucket := boltTx.Bucket([]byte(BucketTransactions))
		return bucket.ForEach(func(k, v []byte) error {
			var t models.Transaction
			if err := json.Unmarshal(v, &t); err == nil {
				if t.Status == models.TransactionStatusActive || t.Status == models.TransactionStatusSuspicious {
					txs = append(txs, t)
				}
			}
			return nil
		})
	})
	return txs, err
}

func (s *BoltStore) GetLongTransactions(threshold time.Duration) ([]models.Transaction, error) {
	var txs []models.Transaction
	err := s.db.View(func(boltTx *bolt.Tx) error {
		bucket := boltTx.Bucket([]byte(BucketTransactions))
		return bucket.ForEach(func(k, v []byte) error {
			var t models.Transaction
			if err := json.Unmarshal(v, &t); err == nil {
				if t.Status == models.TransactionStatusActive && t.Duration > threshold {
					txs = append(txs, t)
				}
			}
			return nil
		})
	})
	return txs, err
}

func (s *BoltStore) UpdateTransaction(tx *models.Transaction) error {
	return s.db.Update(func(boltTx *bolt.Tx) error {
		bucket := boltTx.Bucket([]byte(BucketTransactions))
		data, err := json.Marshal(tx)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(tx.ID), data)
	})
}

func (s *BoltStore) GetAllTransactions() ([]models.Transaction, error) {
	var txs []models.Transaction
	err := s.db.View(func(boltTx *bolt.Tx) error {
		bucket := boltTx.Bucket([]byte(BucketTransactions))
		return bucket.ForEach(func(k, v []byte) error {
			var t models.Transaction
			if err := json.Unmarshal(v, &t); err == nil {
				txs = append(txs, t)
			}
			return nil
		})
	})
	return txs, err
}

// ========== 租户操作 ==========

func (s *BoltStore) CreateTenant(tenant *models.Tenant) error {
	if tenant.ID == "" {
		tenant.ID = uuid.NewString()
	}
	now := time.Now()
	if tenant.CreatedAt.IsZero() {
		tenant.CreatedAt = now
	}
	tenant.UpdatedAt = now

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketTenants))
		data, err := json.Marshal(tenant)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(tenant.ID), data)
	})
}

func (s *BoltStore) GetTenant(id string) (*models.Tenant, error) {
	var tenant models.Tenant
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketTenants))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("tenant not found: %s", id)
		}
		return json.Unmarshal(data, &tenant)
	})
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (s *BoltStore) GetAllTenants() ([]models.Tenant, error) {
	var tenants []models.Tenant
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketTenants))
		return bucket.ForEach(func(k, v []byte) error {
			var t models.Tenant
			if err := json.Unmarshal(v, &t); err == nil {
				tenants = append(tenants, t)
			}
			return nil
		})
	})
	return tenants, err
}

func (s *BoltStore) UpdateTenant(tenant *models.Tenant) error {
	tenant.UpdatedAt = time.Now()
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketTenants))
		data, err := json.Marshal(tenant)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(tenant.ID), data)
	})
}

// ========== 告警操作 ==========

func (s *BoltStore) CreateAlert(alert *models.Alert) error {
	if alert.ID == "" {
		alert.ID = uuid.NewString()
	}
	now := time.Now()
	if alert.CreatedAt.IsZero() {
		alert.CreatedAt = now
	}
	if alert.FirstSeenAt.IsZero() {
		alert.FirstSeenAt = now
	}

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAlerts))
		data, err := json.Marshal(alert)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(alert.ID), data)
	})
}

func (s *BoltStore) GetAlert(id string) (*models.Alert, error) {
	var alert models.Alert
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAlerts))
		data := bucket.Get([]byte(id))
		if data == nil {
			return fmt.Errorf("alert not found: %s", id)
		}
		return json.Unmarshal(data, &alert)
	})
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

func (s *BoltStore) GetOpenAlerts() ([]models.Alert, error) {
	var alerts []models.Alert
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAlerts))
		return bucket.ForEach(func(k, v []byte) error {
			var a models.Alert
			if err := json.Unmarshal(v, &a); err == nil {
				if a.Status == models.AlertStatusOpen || a.Status == models.AlertStatusAcknowledged {
					alerts = append(alerts, a)
				}
			}
			return nil
		})
	})
	return alerts, err
}

func (s *BoltStore) UpdateAlert(alert *models.Alert) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAlerts))
		data, err := json.Marshal(alert)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(alert.ID), data)
	})
}

func (s *BoltStore) GetAllAlerts() ([]models.Alert, error) {
	var alerts []models.Alert
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAlerts))
		return bucket.ForEach(func(k, v []byte) error {
			var a models.Alert
			if err := json.Unmarshal(v, &a); err == nil {
				alerts = append(alerts, a)
			}
			return nil
		})
	})
	return alerts, err
}

// ========== 审计事件操作 ==========

func (s *BoltStore) CreateAuditEvent(event *models.AuditEvent) error {
	if event.ID == "" {
		event.ID = uuid.NewString()
	}

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAuditEvents))
		data, err := json.Marshal(event)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(event.ID), data)
	})
}

func (s *BoltStore) GetAuditEventsByRequest(requestID string) ([]models.AuditEvent, error) {
	var events []models.AuditEvent
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAuditEvents))
		return bucket.ForEach(func(k, v []byte) error {
			var e models.AuditEvent
			if err := json.Unmarshal(v, &e); err == nil {
				if e.RequestID != nil && *e.RequestID == requestID {
					events = append(events, e)
				}
			}
			return nil
		})
	})
	return events, err
}

func (s *BoltStore) GetAuditEventsByConnection(connectionID string) ([]models.AuditEvent, error) {
	var events []models.AuditEvent
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAuditEvents))
		return bucket.ForEach(func(k, v []byte) error {
			var e models.AuditEvent
			if err := json.Unmarshal(v, &e); err == nil {
				if e.ConnectionID != nil && *e.ConnectionID == connectionID {
					events = append(events, e)
				}
			}
			return nil
		})
	})
	return events, err
}

func (s *BoltStore) GetAllAuditEvents() ([]models.AuditEvent, error) {
	var events []models.AuditEvent
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketAuditEvents))
		return bucket.ForEach(func(k, v []byte) error {
			var e models.AuditEvent
			if err := json.Unmarshal(v, &e); err == nil {
				events = append(events, e)
			}
			return nil
		})
	})
	return events, err
}

// ========== 配置操作 ==========

func (s *BoltStore) SaveConfig(key string, value []byte) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketConfig))
		return bucket.Put([]byte(key), value)
	})
}

func (s *BoltStore) GetConfig(key string) ([]byte, error) {
	var value []byte
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketConfig))
		data := bucket.Get([]byte(key))
		if data == nil {
			return fmt.Errorf("config not found: %s", key)
		}
		value = make([]byte, len(data))
		copy(value, data)
		return nil
	})
	return value, err
}

// ========== 批量操作 ==========

func (s *BoltStore) BatchCreateLeases(leases []models.ConnectionLease) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(BucketLeases))
		for i := range leases {
			if leases[i].ID == "" {
				leases[i].ID = uuid.NewString()
			}
			data, err := json.Marshal(&leases[i])
			if err != nil {
				return err
			}
			if err := bucket.Put([]byte(leases[i].ID), data); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *BoltStore) ClearAllData() error {
	return s.db.Update(func(tx *bolt.Tx) error {
		buckets := []string{
			BucketPools, BucketLeases, BucketQueueItems, BucketQueries,
			BucketTransactions, BucketTenants, BucketAlerts, BucketAuditEvents,
		}
		for _, bucket := range buckets {
			b := tx.Bucket([]byte(bucket))
			if b == nil {
				continue
			}
			// 收集所有 key 然后删除
			keys := make([][]byte, 0)
			b.ForEach(func(k, v []byte) error {
				keys = append(keys, k)
				return nil
			})
			for _, k := range keys {
				if err := b.Delete(k); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
