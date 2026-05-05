#ifdef HAS_NUMA

#include "benchmark.h"
#include "utils.h"
#include <numa.h>
#include <numaif.h>
#include <thread>
#include <memory>
#include <cstring>
#include <sched.h>

namespace cache_lab {

namespace {

void SetThreadAffinity(int cpu) {
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(cpu, &cpuset);
    pthread_setaffinity_np(pthread_self(), sizeof(cpu_set_t), &cpuset);
}

int GetNumaNodeForCpu(int cpu) {
    return numa_node_of_cpu(cpu);
}

}

BenchmarkResult NUMATestBenchmark::Run() {
    BenchmarkResult result;
    result.test_name = GetName();
    result.latency_timeline.reserve(4);
    result.thread_conflicts.resize(2, 0);
    
    if (numa_available() < 0) {
        result.metadata["error"] = "NUMA not available on this system";
        result.total_time_ms = 0;
        return result;
    }
    
    int num_nodes = numa_num_configured_nodes();
    int num_cpus = numa_num_configured_cpus();
    
    result.metadata["system_info"] = {
        {"num_numa_nodes", num_nodes},
        {"num_cpus", num_cpus},
        {"preferred_node", numa_preferred()}
    };
    
    std::vector<int> nodes;
    for (int i = 0; i < num_nodes; ++i) {
        if (numa_bitmask_isbitset(numa_nodes_ptr, i)) {
            nodes.push_back(i);
        }
    }
    
    result.metadata["available_nodes"] = nodes;
    
    const size_t array_size = config_.array_size;
    const size_t num_iterations = config_.iterations * 1000;
    
    if (nodes.size() >= 2) {
        int local_node = nodes[0];
        int remote_node = nodes[1];
        
        int local_cpu = 0;
        int remote_cpu = num_cpus / 2;
        
        for (int i = 0; i < num_cpus; ++i) {
            if (GetNumaNodeForCpu(i) == local_node) {
                local_cpu = i;
                break;
            }
        }
        for (int i = 0; i < num_cpus; ++i) {
            if (GetNumaNodeForCpu(i) == remote_node) {
                remote_cpu = i;
                break;
            }
        }
        
        result.metadata["test_setup"] = {
            {"local_node", local_node},
            {"remote_node", remote_node},
            {"local_cpu", local_cpu},
            {"remote_cpu", remote_cpu},
            {"array_size_bytes", array_size},
            {"iterations", num_iterations}
        };
        
        std::thread local_local_thread([&]() {
            SetThreadAffinity(local_cpu);
            
            void* local_array = numa_alloc_onnode(array_size, local_node);
            if (!local_array) {
                result.metadata["local_local_error"] = "Allocation failed";
                return;
            }
            
            std::memset(local_array, 0, array_size);
            
            uint64_t* arr = static_cast<uint64_t*>(local_array);
            size_t num_elements = array_size / sizeof(uint64_t);
            
            utils::Timer timer;
            for (size_t iter = 0; iter < num_iterations; ++iter) {
                for (size_t i = 0; i < num_elements; ++i) {
                    arr[i] = i;
                }
            }
            
            result.latency_timeline.push_back(timer.ElapsedMilliseconds());
            
            numa_free(local_array, array_size);
        });
        
        local_local_thread.join();
        
        std::thread local_remote_thread([&]() {
            SetThreadAffinity(local_cpu);
            
            void* remote_array = numa_alloc_onnode(array_size, remote_node);
            if (!remote_array) {
                result.metadata["local_remote_error"] = "Allocation failed";
                return;
            }
            
            std::memset(remote_array, 0, array_size);
            
            uint64_t* arr = static_cast<uint64_t*>(remote_array);
            size_t num_elements = array_size / sizeof(uint64_t);
            
            utils::Timer timer;
            for (size_t iter = 0; iter < num_iterations; ++iter) {
                for (size_t i = 0; i < num_elements; ++i) {
                    arr[i] = i;
                }
            }
            
            result.latency_timeline.push_back(timer.ElapsedMilliseconds());
            
            numa_free(remote_array, array_size);
        });
        
        local_remote_thread.join();
        
        std::thread remote_local_thread([&]() {
            SetThreadAffinity(remote_cpu);
            
            void* local_array = numa_alloc_onnode(array_size, local_node);
            if (!local_array) {
                result.metadata["remote_local_error"] = "Allocation failed";
                return;
            }
            
            std::memset(local_array, 0, array_size);
            
            uint64_t* arr = static_cast<uint64_t*>(local_array);
            size_t num_elements = array_size / sizeof(uint64_t);
            
            utils::Timer timer;
            for (size_t iter = 0; iter < num_iterations; ++iter) {
                for (size_t i = 0; i < num_elements; ++i) {
                    arr[i] = i;
                }
            }
            
            result.latency_timeline.push_back(timer.ElapsedMilliseconds());
            
            numa_free(local_array, array_size);
        });
        
        remote_local_thread.join();
        
        if (result.latency_timeline.size() >= 2) {
            double local_local = result.latency_timeline[0];
            double local_remote = result.latency_timeline[1];
            
            if (local_local > 0) {
                double slowdown = local_remote / local_local;
                result.metadata["numa_slowdown"] = {
                    {"local_local_ms", local_local},
                    {"local_remote_ms", local_remote},
                    {"slowdown_factor", slowdown},
                    {"slowdown_percent", (slowdown - 1.0) * 100.0}
                };
            }
        }
        
        result.total_time_ms = 0;
        for (const auto& t : result.latency_timeline) {
            result.total_time_ms += t;
        }
        
        result.avg_latency_ns = 0;
        if (result.latency_timeline.size() >= 2 && result.latency_timeline[0] > 0) {
            size_t total_ops = num_iterations * (array_size / sizeof(uint64_t));
            result.avg_latency_ns = (result.latency_timeline[0] * 1000000.0) / total_ops;
        }
        
        result.cache_hits = array_size / 64;
        result.cache_misses = 0;
        
        result.metadata["optimization_suggestions"] = {
            "Allocate memory on the same NUMA node where the thread runs",
            "Use numa_alloc_onnode() or mbind() for explicit NUMA control",
            "Consider thread pinning with pthread_setaffinity_np",
            "Minimize cross-node data sharing for performance-critical code"
        };
        
        result.thread_conflicts[0] = 0;
        result.thread_conflicts[1] = static_cast<size_t>(result.latency_timeline.size() >= 2 ? 
            (result.latency_timeline[1] - result.latency_timeline[0]) : 0);
    }
    
    return result;
}

}

#endif
