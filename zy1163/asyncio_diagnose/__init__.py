"""Asyncio Diagnose Tool - A command-line tool for diagnosing Python asyncio issues.

This tool helps diagnose:
- Stuck coroutines (long-running pending tasks)
- Task leaks (tasks that are never awaited or cancelled)
- Ineffective cancellations (tasks that ignore cancellation)
- Timeout chains (tasks waiting on other tasks with timeouts)
- Queue congestion (tasks blocked on asyncio queues)
"""

__version__ = "0.1.0"
