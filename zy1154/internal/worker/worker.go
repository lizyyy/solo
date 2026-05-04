package worker

import (
	"log"
	"sync"
	"time"

	"saga-demo/internal/models"
	"saga-demo/internal/services"
)

type TaskWorker struct {
	compensationService *services.CompensationService
	outboxService       *services.OutboxService
	stopChan            chan struct{}
	wg                  sync.WaitGroup
	running             bool
	mu                  sync.Mutex
}

func NewTaskWorker(
	compensationService *services.CompensationService,
	outboxService *services.OutboxService,
) *TaskWorker {
	return &TaskWorker{
		compensationService: compensationService,
		outboxService:       outboxService,
		stopChan:            make(chan struct{}),
	}
}

func (w *TaskWorker) Start() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.running {
		return
	}

	w.running = true
	w.stopChan = make(chan struct{})

	w.wg.Add(3)

	go w.compensationLoop()
	go w.outboxLoop()
	go w.retryFailedLoop()

	log.Println("Task worker started")
}

func (w *TaskWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}

	w.running = false
	close(w.stopChan)
	w.mu.Unlock()

	w.wg.Wait()
	log.Println("Task worker stopped")
}

func (w *TaskWorker) compensationLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			if err := w.compensationService.ProcessPendingTasks(); err != nil {
				log.Printf("Error processing compensation tasks: %v", err)
			}
		}
	}
}

func (w *TaskWorker) outboxLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			err := w.outboxService.ProcessEvents(func(event *models.OutboxEvent) error {
				log.Printf("Outbox event published: ID=%s, Type=%s, AggregateID=%s",
					event.ID, event.EventType, event.AggregateID)
				return nil
			})
			if err != nil {
				log.Printf("Error processing outbox events: %v", err)
			}
		}
	}
}

func (w *TaskWorker) retryFailedLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return
		case <-ticker.C:
			tasks, err := w.compensationService.GetFailedTasks()
			if err != nil {
				log.Printf("Error getting failed tasks: %v", err)
				continue
			}

			for _, task := range tasks {
				if task.RetryCount < task.MaxRetries {
					log.Printf("Retrying compensation task: %s (retry %d/%d)",
						task.ID, task.RetryCount+1, task.MaxRetries)
					if err := w.compensationService.ExecuteTask(&task); err != nil {
						log.Printf("Retry failed for task %s: %v", task.ID, err)
					}
				}
			}
		}
	}
}
