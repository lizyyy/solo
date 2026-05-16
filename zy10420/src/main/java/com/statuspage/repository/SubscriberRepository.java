package com.statuspage.repository;

import com.statuspage.model.Subscriber;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubscriberRepository extends JpaRepository<Subscriber, Long> {
    Optional<Subscriber> findBySubscriberId(String subscriberId);
    boolean existsBySubscriberId(String subscriberId);
    List<Subscriber> findByActiveTrue();
}