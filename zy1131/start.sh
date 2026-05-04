#!/bin/bash

echo "=========================================="
echo "  PCB Pre-Validation Tool"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "ERROR: Python not found. Please install Python 3.8+."
        exit 1
    fi
    
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    echo "Python version: $PYTHON_VERSION"
}

check_venv() {
    if [ -d "venv" ]; then
        echo "Virtual environment found"
        VENV_EXISTS=true
    else
        echo "Virtual environment not found"
        VENV_EXISTS=false
    fi
}

create_venv() {
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment"
        exit 1
    fi
    echo "Virtual environment created successfully"
}

activate_venv() {
    if [ "$VENV_EXISTS" = false ] || [ ! -f "venv/bin/activate" ]; then
        echo "ERROR: Virtual environment not properly set up"
        exit 1
    fi
    source venv/bin/activate
    echo "Virtual environment activated"
}

install_deps() {
    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo "Dependencies installed successfully"
}

run_self_test() {
    echo ""
    echo "Running self-test..."
    echo "----------------------------------------"
    python test_rule_engine.py
    TEST_RESULT=$?
    echo "----------------------------------------"
    return $TEST_RESULT
}

start_server() {
    echo ""
    echo "Starting FastAPI server..."
    echo "=========================================="
    echo "  Server will run at: http://localhost:8000"
    echo "  API docs:          http://localhost:8000/docs"
    echo "  Frontend:          http://localhost:8000/static/index.html"
    echo "=========================================="
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    
    cd backend
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}

show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start      Start the application (default)"
    echo "  install    Install dependencies only"
    echo "  test       Run self-test only"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0           # Start application"
    echo "  $0 install   # Install dependencies"
    echo "  $0 test      # Run tests"
    echo ""
}

COMMAND="${1:-start}"

case $COMMAND in
    help)
        show_help
        exit 0
        ;;
    install)
        check_python
        check_venv
        if [ "$VENV_EXISTS" = false ]; then
            create_venv
        fi
        activate_venv
        install_deps
        echo ""
        echo "Installation complete! Run '$0 start' to launch the application."
        exit 0
        ;;
    test)
        check_python
        check_venv
        if [ "$VENV_EXISTS" = false ]; then
            create_venv
        fi
        activate_venv
        install_deps
        run_self_test
        exit $?
        ;;
    start)
        check_python
        check_venv
        if [ "$VENV_EXISTS" = false ]; then
            create_venv
        fi
        activate_venv
        install_deps
        run_self_test
        if [ $? -ne 0 ]; then
            echo ""
            echo "WARNING: Self-test found issues. Do you want to continue? [Y/n]"
            read -r CONTINUE
            if [[ "$CONTINUE" =~ ^[Nn]$ ]]; then
                echo "Aborting."
                exit 1
            fi
        fi
        start_server
        ;;
    *)
        echo "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac
