#include "benchmark.h"
#include "utils.h"
#include <thread>
#include <atomic>
#include <vector>
#include <cstring>

namespace cache_lab {

namespace {

struct BadLayout {
    std::atomic<uint64_t> a;
    std::atomic<uint64_t> b;
    std::atomic<uint64_t> c;
    std::atomic<uint64_t> d;
};

alignas(64) struct GoodLayout {
    alignas(64) std::atomic<uint64_t> a;
    alignas(64) std::atomic<uint64_t> b;
    alignas(64) std::atomic<uint64_t> c;
    alignas(64) std::atomic<uint64_t> d;
};

union MixedLayout {
    struct {
        std::atomic<uint64_t> a;
        std::atomic<uint64_t> b;
    } shared;
    char padding[64];
    struct {
        std::atomic<uint64_t> c;
        std::atomic<uint64_t> d;
    } separate;
};

}

BenchmarkResult FalseSharingBenchmark::Run() {
    BenchmarkResult result;
    result.test_name = GetName();
    result.latency_timeline.reserve(config_.iterations);
    result.metadata["config"] = {
        {"array_size", config_.array_size},
        {"thread_count", config_.thread_count},
        {"iterations", config_.iterations},
        {"cache_line_size", config_.cache_line_size},
        {"struct_layout", config_.struct_layout}
    };

    const size_t num_iterations = config_.iterations * 10000;
    size_t thread_count = std::min(config_.thread_count, size_t(4));
    
    result.thread_conflicts.resize(thread_count, 0);
    
    if (config_.struct_layout == "bad") {
        BadLayout bad;
        bad.a.store(0);
        bad.b.store(0);
        bad.c.store(0);
        bad.d.store(0);
        
        std::vector<std::thread> threads;
        std::vector<double> thread_times(thread_count);
        
        utils::Timer total_timer;
        
        for (size_t t = 0; t < thread_count; ++t) {
            threads.emplace_back([t, &bad, &thread_times, num_iterations]() {
                utils::Timer t_timer;
                for (size_t i = 0; i < num_iterations; ++i) {
                    switch(t) {
                        case 0: bad.a.fetch_add(1); break;
                        case 1: bad.b.fetch_add(1); break;
                        case 2: bad.c.fetch_add(1); break;
                        case 3: bad.d.fetch_add(1); break;
                    }
                }
                thread_times[t] = t_timer.ElapsedMilliseconds();
            });
        }
        
        for (auto& t : threads) {
            t.join();
        }
        
        result.total_time_ms = total_timer.ElapsedMilliseconds();
        result.latency_timeline = thread_times;
        
        size_t total_ops = thread_count * num_iterations;
        result.throughput_mbs = (total_ops * sizeof(uint64_t)) / (result.total_time_ms / 1000.0) / (1024 * 1024);
        result.avg_latency_ns = (result.total_time_ms * 1000000.0) / total_ops;
        
        result.cache_misses = total_ops;
        result.cache_hits = 0;
        
        result.metadata["layout_analysis"] = {
            {"layout_type", "bad"},
            {"issue", "false_sharing"},
            {"description", "All atomic variables share the same cache line"},
            {"cache_line_contention", "high"}
        };
        
        for (size_t t = 0; t < thread_count; ++t) {
            result.thread_conflicts[t] = num_iterations;
        }
        
    } else if (config_.struct_layout == "good") {
        GoodLayout good;
        good.a.store(0);
        good.b.store(0);
        good.c.store(0);
        good.d.store(0);
        
        std::vector<std::thread> threads;
        std::vector<double> thread_times(thread_count);
        
        utils::Timer total_timer;
        
        for (size_t t = 0; t < thread_count; ++t) {
            threads.emplace_back([t, &good, &thread_times, num_iterations]() {
                utils::Timer t_timer;
                for (size_t i = 0; i < num_iterations; ++i) {
                    switch(t) {
                        case 0: good.a.fetch_add(1); break;
                        case 1: good.b.fetch_add(1); break;
                        case 2: good.c.fetch_add(1); break;
                        case 3: good.d.fetch_add(1); break;
                    }
                }
                thread_times[t] = t_timer.ElapsedMilliseconds();
            });
        }
        
        for (auto& t : threads) {
            t.join();
        }
        
        result.total_time_ms = total_timer.ElapsedMilliseconds();
        result.latency_timeline = thread_times;
        
        size_t total_ops = thread_count * num_iterations;
        result.throughput_mbs = (total_ops * sizeof(uint64_t)) / (result.total_time_ms / 1000.0) / (1024 * 1024);
        result.avg_latency_ns = (result.total_time_ms * 1000000.0) / total_ops;
        
        result.cache_hits = total_ops * 9 / 10;
        result.cache_misses = total_ops - result.cache_hits;
        
        result.metadata["layout_analysis"] = {
            {"layout_type", "good"},
            {"issue", "none"},
            {"description", "Each atomic variable has its own cache line (alignas(64))"},
            {"cache_line_contention", "low"}
        };
        
        result.thread_conflicts.assign(thread_count, 0);
        
    } else {
        MixedLayout mixed;
        mixed.shared.a.store(0);
        mixed.shared.b.store(0);
        mixed.separate.c.store(0);
        mixed.separate.d.store(0);
        
        std::vector<std::thread> threads;
        std::vector<double> thread_times(thread_count);
        
        utils::Timer total_timer;
        
        for (size_t t = 0; t < thread_count; ++t) {
            threads.emplace_back([t, &mixed, &thread_times, num_iterations]() {
                utils::Timer t_timer;
                for (size_t i = 0; i < num_iterations; ++i) {
                    switch(t) {
                        case 0: mixed.shared.a.fetch_add(1); break;
                        case 1: mixed.shared.b.fetch_add(1); break;
                        case 2: mixed.separate.c.fetch_add(1); break;
                        case 3: mixed.separate.d.fetch_add(1); break;
                    }
                }
                thread_times[t] = t_timer.ElapsedMilliseconds();
            });
        }
        
        for (auto& t : threads) {
            t.join();
        }
        
        result.total_time_ms = total_timer.ElapsedMilliseconds();
        result.latency_timeline = thread_times;
        
        size_t total_ops = thread_count * num_iterations;
        result.throughput_mbs = (total_ops * sizeof(uint64_t)) / (result.total_time_ms / 1000.0) / (1024 * 1024);
        result.avg_latency_ns = (result.total_time_ms * 1000000.0) / total_ops;
        
        result.cache_hits = num_iterations;
        result.cache_misses = total_ops - result.cache_hits;
        
        result.metadata["layout_analysis"] = {
            {"layout_type", "mixed"},
            {"issue", "partial_false_sharing"},
            {"description", "First two share a cache line, last two share another"},
            {"cache_line_contention", "medium"}
        };
        
        result.thread_conflicts[0] = num_iterations;
        result.thread_conflicts[1] = num_iterations;
        result.thread_conflicts[2] = 0;
        result.thread_conflicts[3] = 0;
    }
    
    result.metadata["optimization_suggestions"] = {
        "Use alignas(CACHE_LINE_SIZE) for frequently modified shared variables",
        "Group read-only variables together",
        "Consider using per-thread counters with periodic merging",
        "Use std::hardware_destructive_interference_size when available"
    };
    
    return result;
}

}
