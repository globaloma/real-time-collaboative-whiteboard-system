"""Production entrypoint: `gunicorn --worker-class gthread --threads 8 -w 1 wsgi:app`.

Plain real-thread deployment — no eventlet/gevent monkey-patching. That
trade-off (Socket.IO falls back to long-polling instead of a raw WebSocket
upgrade) buys full compatibility with grpc, which firebase-admin uses
internally and which does not coexist reliably with monkey-patched green
threads: grpc spawns its own background I/O threads via Python's
`threading.Thread`, and eventlet/gevent turn those into cooperative
greenthreads too, silently breaking them regardless of import timing.
"""

from app import app  # noqa: F401
