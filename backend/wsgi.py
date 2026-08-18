"""Production entrypoint: `gunicorn --worker-class eventlet -w 1 wsgi:app`.

Deliberately does NOT call eventlet.monkey_patch() itself. gunicorn's eventlet
worker class (gunicorn/workers/geventlet.py) already does that correctly,
scoped to just the forked worker process, after fork. Calling it manually
here would also run in the arbiter (master) process — which imports this
module too, to validate the app before forking — and monkey-patching the
arbiter breaks its own signal handling ("do not call blocking functions
from the mainloop").
"""

from app import app  # noqa: F401
