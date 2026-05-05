#include "benchmark.h"
#include "utils.h"
#include <memory>
#include <cstring>

namespace cache_lab {

BenchmarkResult StrideAccessBenchmark::Run() {
    BenchmarkResult result;
    result.test_name = GetName();
    result.latency_timeline.reserve(config_.iterations);
    result.metadata["config"] = {
        {"array_size", config_.array_size},
        {"stride", config_.stride},
        {"iterations", config_.iterations},
        {"cache_line_size", config_.cache_line_size}
    };

    size_t element_size = sizeof(uint64_t);
    size_t num_elements = config_.array_size / element_size;
    
    std::unique_ptr<uint64_t[]> array(new uint64_t[num_elements]);
    std::memset(array.get(), 0, config_.array_size);

    utils::Timer total_timer;
    
    for (int iter = 0; iter < config_.iterations; ++iter) {
        utils::Timer iter_timer;
        
        for (size_t s = 0; s < config_.stride; ++s) {
            for (size_t i = s; i < num_elements; i += config_.stride) {
                array[i] = i;
            }
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
    
    if (config_.stride >= cache_line_elements) {
        result.cache_misses = elements_accessed;
        result.cache_hits = 0;
    } else {
        size_t misses_per_line = (cache_line_elements + config_.stride - 1) / config_.stride;
        size_t total_lines = num_elements / cache_line_elements;
        result.cache_misses = misses_per_line * total_lines;
        result.cache_hits = elements_accessed - result.cache_misses;
    }
    
    result.metadata["stride_analysis"] = {
        {"cache_line_elements", cache_line_elements},
        {"stride_efficiency", config_.stride < cache_line_elements ? "good" : "bad"}
    };
    
    result.thread_conflicts.resize(config_.thread_count, 0);
    
    return result;
}

}
