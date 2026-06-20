from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello, 门店评论情绪漂移系统已启动！'

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5080, debug=False)
