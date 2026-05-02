"""
Entry point for running nb_repro_audit as a module.

Usage: python -m nb_repro_audit audit ...
"""

from .cli import main

if __name__ == '__main__':
    exit(main())
