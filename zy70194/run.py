from app import create_app

app = create_app()

if __name__ == '__main__':
    print('采购询价比价服务启动中...')
    print('服务地址: http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=False)
