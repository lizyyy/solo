package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.Dispatcher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DispatcherRepository extends JpaRepository<Dispatcher, Long> {
    Optional<Dispatcher> findByDispatcherNoAndActiveTrue(String dispatcherNo);

    boolean existsByDispatcherNoAndActiveTrue(String dispatcherNo);
}
