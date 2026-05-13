package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.ServiceInstance;
import com.infrastructure.drain.model.DrainStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceInstanceRepository extends JpaRepository<ServiceInstance, Long> {
    
    Optional<ServiceInstance> findByInstanceId(String instanceId);
    
    boolean existsByInstanceId(String instanceId);
    
    List<ServiceInstance> findByBatch_BatchId(String batchId);
    
    @Query("SELECT i FROM ServiceInstance i WHERE i.status NOT IN (:completedStatuses)")
    List<ServiceInstance> findActiveInstances(@Param("completedStatuses") List<DrainStatus> completedStatuses);
    
    @Query("SELECT i FROM ServiceInstance i WHERE i.instanceId IN :instanceIds")
    List<ServiceInstance> findByInstanceIds(@Param("instanceIds") List<String> instanceIds);
}
