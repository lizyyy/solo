"""码头岸桥作业半径 - 启动入口."""
from quay_crane.app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
