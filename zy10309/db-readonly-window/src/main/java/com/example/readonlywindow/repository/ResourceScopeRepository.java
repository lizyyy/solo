package com.example.readonlywindow.repository;

import com.example.readonlywindow.entity.ResourceScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceScopeRepository extends JpaRepository<ResourceScope, Long> {
    List<ResourceScope> findByFreezeWindowId(Long windowId);
    List<ResourceScope> findByResourceTypeAndResourceName(String resourceType, String resourceName);
}
