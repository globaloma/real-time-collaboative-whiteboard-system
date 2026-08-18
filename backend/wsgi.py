"""Production entrypoint: `gunicorn --worker-class eventlet -w 1 wsgi:app`.

eventlet.monkey_patch() must run before any other module (including app.py,
which imports threading) is imported, so this file exists separately from
app.py rather than putting the patch inside it.
"""

import eventlet

eventlet.monkey_patch()

from app import app  # noqa: E402
