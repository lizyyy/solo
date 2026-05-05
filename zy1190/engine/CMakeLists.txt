cmake_minimum_required(VERSION 3.15)
project(CacheLabEngine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(APPLE)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -march=native -Wall -Wextra")
else()
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -march=native -Wall -Wextra -pthread")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -lnuma")
endif()

include_directories(include)

add_library(cache_engine STATIC
    src/benchmark.cpp
    src/sequential_access.cpp
    src/stride_access.cpp
    src/random_access.cpp
    src/false_sharing.cpp
    src/numa_test.cpp
    src/utils.cpp
)

add_executable(cache_bench main.cpp)
target_link_libraries(cache_bench cache_engine)

if(NOT APPLE)
    target_compile_definitions(cache_engine PRIVATE HAS_NUMA)
    target_compile_definitions(cache_bench PRIVATE HAS_NUMA)
endif()

install(TARGETS cache_bench DESTINATION bin)
