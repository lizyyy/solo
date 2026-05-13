package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.PersistentConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PersistentConnectionRepository extends JpaRepository<PersistentConnection, Long> {
    
    List<PersistentConnection> findByInstanceId(String instanceId);
    
    int countByInstanceIdAndStatus(String instanceId, String status);
}
