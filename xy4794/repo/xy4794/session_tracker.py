from sqlalchemy import event
from sqlalchemy.engine import Engine

query_count = [0]

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    query_count[0] += 1

def reset_query_count():
    query_count[0] = 0

def get_query_count():
    return query_count[0]
