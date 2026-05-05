#include "benchmark.h"
#include "utils.h"
#include <memory>
#include <cstring>
#include <algorithm>

namespace cache_lab {

BenchmarkResult RandomAccessBenchmark::Run() {
    BenchmarkResult result;
    result.test_name = GetName();
    result.latency_timeline.reserve(config_.iterations);
    result.metadata["config"] = {
        {"array_size", config_.array_size},
        {"iterations", config_.iterations},
        {"cache_line_size", config_.cache_line_size},
        {"seed", config_.seed}
    };

    size_t element_size = sizeof(uint64_t);
    size_t num_elements = config_.array_size / element_size;
    
    std::unique_ptr<uint64_t[]> array(new uint64_t[num_elements]);
    std::memset(array.get(), 0, config_.array_size);
    
    std::vector<size_t> indices(num_elements);
    for (size_t i = 0; i < num_elements; ++i) {
        indices[i] = i;
    }
    
    utils::RandomGenerator rng(config_.seed);
    rng.Shuffle(indices);

    utils::Timer total_timer;
    
    for (int iter = 0; iter < config_.iterations; ++iter) {
        utils::Timer iter_timer;
        
        for (size_t i = 0; i < num_elements; ++i) {
            array[indices[i]] = i;
        }
        
        double latency = iter_timer.ElapsedNanoseconds() / num_elements;
        result.latency_timeline.push_back(latency);
    }
    
    result.total_time_ms = total_timer.ElapsedMilliseconds();
    result.throughput_mbs = (config_.array_size * config_.iterations) / (result.total_time_ms / 1000.0) / (1024 * 1024);
    result.avg_latency_ns = 0;
    for (const auto& l : result.latency_timeline) {
        result.avg_latency_ns += l;
    }
    if (!result.latency_timeline.empty()) {
        result.avg_latency_ns /= result.latency_timeline.size();
    }
    
    size_t cache_line_elements = config_.cache_line_size / element_size;
    size_t elements_accessed = num_elements;
    
    result.cache_misses = num_elements;
    result.cache_hits = 0;
    
    size_t reuses = 0;
    size_t prev_line = static_cast<size_t>(-1);
    for (size_t idx : indices) {
        size_t line = idx / cache_line_elements;
        if (line == prev_line) {
            reuses++;
        }
        prev_line = line;
    }
    result.cache_hits = reuses;
    result.cache_misses = elements_accessed - reuses;
    
    result.metadata["random_analysis"] = {
        {"cache_line_elements", cache_line_elements},
        {"temporal_locality", "low"},
        {"spatial_locality", "low"}
    };
    
    result.thread_conflicts.resize(config_.thread_count, 0);
    
    return result;
}

}
