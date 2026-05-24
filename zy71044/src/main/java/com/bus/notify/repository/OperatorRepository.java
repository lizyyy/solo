package com.bus.notify.repository;

import com.bus.notify.entity.Operator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OperatorRepository extends JpaRepository<Operator, Long> {
    Optional<Operator> findByUsername(String username);
    
    List<Operator> findByActiveTrue();
    
    boolean existsByUsername(String username);
}
