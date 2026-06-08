from station_passenger_flow.app import create_app

app = create_app()

if __name__ == "__main__":
    print("=" * 60)
    print("  地铁站厅客流瓶颈 - 启动中")
    print("  打开浏览器访问: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(debug=True, port=5000)
