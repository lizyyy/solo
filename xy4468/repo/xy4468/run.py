import os
from app import create_app, db
from config import Config

app = create_app(Config)

@app.shell_context_processor
def make_shell_context():
    return dict(db=db)

@app.cli.command()
def init_db():
    """Initialize the database."""
    db.create_all()
    print('Database initialized.')

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=9090)
