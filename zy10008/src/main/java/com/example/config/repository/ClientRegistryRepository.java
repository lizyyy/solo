package com.example.config.repository;

import com.example.config.domain.ClientRegistry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface ClientRegistryRepository extends JpaRepository<ClientRegistry, Long> {

    Optional<ClientRegistry> findByInstanceId(String instanceId);

    List<ClientRegistry> findByServiceName(String serviceName);

    List<ClientRegistry> findByStatus(ClientRegistry.ConnectionStatus status);

    @Query("SELECT c FROM ClientRegistry c JOIN c.subscriptions s WHERE s = :namespace AND c.status = :status")
    List<ClientRegistry> findSubscribedClients(
            @Param("namespace") String namespace,
            @Param("status") ClientRegistry.ConnectionStatus status);

    @Query("SELECT c FROM ClientRegistry c WHERE c.lastHeartbeatAt < :threshold AND c.status = :connected")
    List<ClientRegistry> findStaleClients(
            @Param("threshold") LocalDateTime threshold,
            @Param("connected") ClientRegistry.ConnectionStatus connected);

    @Query("SELECT DISTINCT s FROM ClientRegistry c JOIN c.subscriptions s WHERE c.status = :status")
    Set<String> findAllActiveNamespaces(@Param("status") ClientRegistry.ConnectionStatus status);

    long countByStatus(ClientRegistry.ConnectionStatus status);
}
