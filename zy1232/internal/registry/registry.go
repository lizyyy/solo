package registry

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/model"
)

var (
	ErrInstanceNotFound = errors.New("instance not found")
	ErrServiceNotFound  = errors.New("service not found")
	ErrInstanceExists   = errors.New("instance already exists")
)

type Registry struct {
	services map[string]*model.Service
	mu       sync.RWMutex
}

func NewRegistry() *Registry {
	return &Registry{
		services: make(map[string]*model.Service),
	}
}

func (r *Registry) Register(instance *model.ServiceInstance) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if instance.ID == "" {
		instance.ID = generateInstanceID(instance.Service, instance.Address, instance.Port)
	}

	instance.Status = "healthy"
	instance.CreatedAt = time.Now()
	instance.UpdatedAt = time.Now()

	service, exists := r.services[instance.Service]
	if !exists {
		service = &model.Service{
			Name:      instance.Service,
			Instances: []model.ServiceInstance{},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		r.services[instance.Service] = service
	}

	for _, inst := range service.Instances {
		if inst.ID == instance.ID {
			return ErrInstanceExists
		}
	}

	service.Instances = append(service.Instances, *instance)
	service.Healthy++
	service.UpdatedAt = time.Now()

	log.Info().
		Str("service", instance.Service).
		Str("instance_id", instance.ID).
		Str("address", instance.Address).
		Int("port", instance.Port).
		Msg("Instance registered")

	return nil
}

func (r *Registry) Deregister(serviceName, instanceID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	service, exists := r.services[serviceName]
	if !exists {
		return ErrServiceNotFound
	}

	for i, inst := range service.Instances {
		if inst.ID == instanceID {
			if inst.Status == "healthy" {
				service.Healthy--
			} else {
				service.Unhealthy--
			}

			service.Instances = append(service.Instances[:i], service.Instances[i+1:]...)
			service.UpdatedAt = time.Now()

			log.Info().
				Str("service", serviceName).
				Str("instance_id", instanceID).
				Msg("Instance deregistered")

			return nil
		}
	}

	return ErrInstanceNotFound
}

func (r *Registry) GetService(serviceName string) (*model.Service, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	service, exists := r.services[serviceName]
	if !exists {
		return nil, ErrServiceNotFound
	}

	result := &model.Service{
		Name:      service.Name,
		Instances: make([]model.ServiceInstance, len(service.Instances)),
		Healthy:   service.Healthy,
		Unhealthy: service.Unhealthy,
		CreatedAt: service.CreatedAt,
		UpdatedAt: service.UpdatedAt,
	}
	copy(result.Instances, service.Instances)

	return result, nil
}

func (r *Registry) GetHealthyInstances(serviceName string) ([]model.ServiceInstance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	service, exists := r.services[serviceName]
	if !exists {
		return nil, ErrServiceNotFound
	}

	var healthy []model.ServiceInstance
	for _, inst := range service.Instances {
		if inst.Status == "healthy" {
			healthy = append(healthy, inst)
		}
	}

	return healthy, nil
}

func (r *Registry) GetInstance(serviceName, instanceID string) (*model.ServiceInstance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	service, exists := r.services[serviceName]
	if !exists {
		return nil, ErrServiceNotFound
	}

	for _, inst := range service.Instances {
		if inst.ID == instanceID {
			return &inst, nil
		}
	}

	return nil, ErrInstanceNotFound
}

func (r *Registry) UpdateHealth(serviceName, instanceID string, healthy bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	service, exists := r.services[serviceName]
	if !exists {
		return ErrServiceNotFound
	}

	for i, inst := range service.Instances {
		if inst.ID == instanceID {
			oldStatus := inst.Status
			if healthy {
				inst.Status = "healthy"
				if oldStatus != "healthy" {
					service.Healthy++
					service.Unhealthy--
				}
			} else {
				inst.Status = "unhealthy"
				if oldStatus != "unhealthy" {
					service.Healthy--
					service.Unhealthy++
				}
			}
			inst.UpdatedAt = time.Now()
			service.Instances[i] = inst
			service.UpdatedAt = time.Now()

			log.Info().
				Str("service", serviceName).
				Str("instance_id", instanceID).
				Str("status", inst.Status).
				Msg("Instance health updated")

			return nil
		}
	}

	return ErrInstanceNotFound
}

func (r *Registry) ListServices() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	services := make([]string, 0, len(r.services))
	for name := range r.services {
		services = append(services, name)
	}
	return services
}

func (r *Registry) AllServices() map[string]*model.Service {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string]*model.Service)
	for name, svc := range r.services {
		result[name] = &model.Service{
			Name:      svc.Name,
			Instances: make([]model.ServiceInstance, len(svc.Instances)),
			Healthy:   svc.Healthy,
			Unhealthy: svc.Unhealthy,
			CreatedAt: svc.CreatedAt,
			UpdatedAt: svc.UpdatedAt,
		}
		copy(result[name].Instances, svc.Instances)
	}
	return result
}

func generateInstanceID(service, address string, port int) string {
	return fmt.Sprintf("%s-%s-%d", service, address, port)
}
