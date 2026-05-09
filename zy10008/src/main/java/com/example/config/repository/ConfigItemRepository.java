package com.example.config.repository;

import com.example.config.domain.ConfigItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigItemRepository extends JpaRepository<ConfigItem, Long> {

    Optional<ConfigItem> findByNamespaceAndConfigKey(String namespace, String configKey);

    List<ConfigItem> findByNamespace(String namespace);

    @Query("SELECT c FROM ConfigItem c WHERE c.namespace = :namespace AND c.enabled = true")
    List<ConfigItem> findActiveByNamespace(@Param("namespace") String namespace);

    @Query("SELECT MAX(c.version) FROM ConfigItem c WHERE c.namespace = :namespace AND c.configKey = :configKey")
    Optional<Long> findMaxVersion(@Param("namespace") String namespace, @Param("configKey") String configKey);

    @Query("SELECT c.version FROM ConfigItem c WHERE c.namespace = :namespace AND c.configKey = :configKey")
    Optional<Long> findCurrentVersion(@Param("namespace") String namespace, @Param("configKey") String configKey);
}
