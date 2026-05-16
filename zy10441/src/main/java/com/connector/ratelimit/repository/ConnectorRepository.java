package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.Connector;
import com.connector.ratelimit.model.enums.SleepStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConnectorRepository extends JpaRepository<Connector, Long> {
    Optional<Connector> findByConnectorCode(String connectorCode);
    List<Connector> findByStatus(SleepStatus status);
    List<Connector> findBySupplierCode(String supplierCode);
}
