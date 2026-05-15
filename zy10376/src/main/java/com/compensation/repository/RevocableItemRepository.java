package com.compensation.repository;

import com.compensation.entity.RevocableItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RevocableItemRepository extends JpaRepository<RevocableItem, Long> {
    
    Optional<RevocableItem> findByItemId(String itemId);
    
    boolean existsByItemId(String itemId);
    
    List<RevocableItem> findByExecutedActionId(Long actionId);
    
    List<RevocableItem> findByExecutedActionActionId(String actionId);
    
    List<RevocableItem> findByRevocableTrue();
}
