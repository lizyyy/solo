package com.airport.baggage.repository;

import com.airport.baggage.entity.BaggageTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BaggageTagRepository extends JpaRepository<BaggageTag, Long> {
    Optional<BaggageTag> findByTagNumber(String tagNumber);
}
