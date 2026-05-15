from app import create_app, db
from app.models import (
    UploadPackage, ParseResult, PreviewDiff, ConfirmationToken,
    WriteBatch, RevocationWindow, OperationHistory
)

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'UploadPackage': UploadPackage,
        'ParseResult': ParseResult,
        'PreviewDiff': PreviewDiff,
        'ConfirmationToken': ConfirmationToken,
        'WriteBatch': WriteBatch,
        'RevocationWindow': RevocationWindow,
        'OperationHistory': OperationHistory
    }

@app.cli.command('init-db')
def init_db():
    db.create_all()
    print('Database initialized.')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5001)
