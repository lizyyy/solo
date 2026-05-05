package tests

import (
	"testing"

	"github.com/zy1232/microservice-framework/internal/model"
	"github.com/zy1232/microservice-framework/internal/registry"
)

func TestRegistry_Register(t *testing.T) {
	reg := registry.NewRegistry()

	instance := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	err := reg.Register(instance)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}

	if instance.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got: %s", instance.Status)
	}

	if instance.ID == "" {
		t.Error("Expected instance ID to be generated")
	}
}

func TestRegistry_Register_Duplicate(t *testing.T) {
	reg := registry.NewRegistry()

	instance := &model.ServiceInstance{
		ID:      "test-instance-1",
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	err := reg.Register(instance)
	if err != nil {
		t.Errorf("First registration should succeed: %v", err)
	}

	err = reg.Register(instance)
	if err != registry.ErrInstanceExists {
		t.Errorf("Expected ErrInstanceExists, got: %v", err)
	}
}

func TestRegistry_Deregister(t *testing.T) {
	reg := registry.NewRegistry()

	instance := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	err := reg.Register(instance)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	instanceID := instance.ID

	err = reg.Deregister("user", instanceID)
	if err != nil {
		t.Errorf("Deregister failed: %v", err)
	}

	err = reg.Deregister("user", instanceID)
	if err != registry.ErrInstanceNotFound {
		t.Errorf("Expected ErrInstanceNotFound, got: %v", err)
	}
}

func TestRegistry_GetService(t *testing.T) {
	reg := registry.NewRegistry()

	_, err := reg.GetService("nonexistent")
	if err != registry.ErrServiceNotFound {
		t.Errorf("Expected ErrServiceNotFound, got: %v", err)
	}

	instance := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	err = reg.Register(instance)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	service, err := reg.GetService("user")
	if err != nil {
		t.Errorf("GetService failed: %v", err)
	}

	if service.Name != "user" {
		t.Errorf("Expected service name 'user', got: %s", service.Name)
	}

	if service.Healthy != 1 {
		t.Errorf("Expected 1 healthy instance, got: %d", service.Healthy)
	}
}

func TestRegistry_UpdateHealth(t *testing.T) {
	reg := registry.NewRegistry()

	instance := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	err := reg.Register(instance)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	instanceID := instance.ID

	service, _ := reg.GetService("user")
	if service.Unhealthy != 0 {
		t.Errorf("Expected 0 unhealthy instances, got: %d", service.Unhealthy)
	}

	err = reg.UpdateHealth("user", instanceID, false)
	if err != nil {
		t.Errorf("UpdateHealth failed: %v", err)
	}

	service, _ = reg.GetService("user")
	if service.Unhealthy != 1 {
		t.Errorf("Expected 1 unhealthy instance, got: %d", service.Unhealthy)
	}
	if service.Healthy != 0 {
		t.Errorf("Expected 0 healthy instances, got: %d", service.Healthy)
	}
}

func TestRegistry_GetHealthyInstances(t *testing.T) {
	reg := registry.NewRegistry()

	instance1 := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	instance2 := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8092,
	}

	err := reg.Register(instance1)
	if err != nil {
		t.Fatalf("Register instance1 failed: %v", err)
	}

	err = reg.Register(instance2)
	if err != nil {
		t.Fatalf("Register instance2 failed: %v", err)
	}

	healthy, err := reg.GetHealthyInstances("user")
	if err != nil {
		t.Errorf("GetHealthyInstances failed: %v", err)
	}

	if len(healthy) != 2 {
		t.Errorf("Expected 2 healthy instances, got: %d", len(healthy))
	}

	err = reg.UpdateHealth("user", instance1.ID, false)
	if err != nil {
		t.Fatalf("UpdateHealth failed: %v", err)
	}

	healthy, err = reg.GetHealthyInstances("user")
	if err != nil {
		t.Errorf("GetHealthyInstances failed: %v", err)
	}

	if len(healthy) != 1 {
		t.Errorf("Expected 1 healthy instance after marking one unhealthy, got: %d", len(healthy))
	}
}

func TestRegistry_ListServices(t *testing.T) {
	reg := registry.NewRegistry()

	services := reg.ListServices()
	if len(services) != 0 {
		t.Errorf("Expected 0 services, got: %d", len(services))
	}

	instance1 := &model.ServiceInstance{
		Service: "user",
		Address: "localhost",
		Port:    8091,
	}

	instance2 := &model.ServiceInstance{
		Service: "order",
		Address: "localhost",
		Port:    8092,
	}

	_ = reg.Register(instance1)
	_ = reg.Register(instance2)

	services = reg.ListServices()
	if len(services) != 2 {
		t.Errorf("Expected 2 services, got: %d", len(services))
	}
}
