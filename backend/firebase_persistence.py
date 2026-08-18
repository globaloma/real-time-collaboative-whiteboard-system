import json
import os
import time

COLLECTION_NAME = os.getenv("FIREBASE_COLLECTION_NAME", "whiteboard_rooms")

_firestore_client = None
_initialized = False
_init_error = None

# grpc (used internally by firebase-admin/google-cloud-firestore) is
# documented to not survive fork(): its background completion-queue threads
# exist in the parent process at the time of the fork but not in the child,
# so a channel created — or even just imported — before gunicorn forks its
# worker leaves the worker with grpc state that hangs on the first real RPC.
# Both the import and initialization are therefore deferred to first use,
# which only ever happens inside a worker process handling a real request —
# the arbiter (master process) never does that, even though it does import
# this module to resolve the app callable before forking.
_USE_EVENTLET_TPOOL = os.getenv("SOCKETIO_ASYNC_MODE") == "eventlet"


def _run_blocking(fn):
    if _USE_EVENTLET_TPOOL:
        import eventlet.tpool

        return eventlet.tpool.execute(fn)
    return fn()


def _build_credentials(credentials_module):
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    if service_account_path:
        return credentials_module.Certificate(service_account_path)

    if service_account_json:
        data = json.loads(service_account_json)
        return credentials_module.Certificate(data)

    return None


def _init_firestore_client():
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        cred = _build_credentials(credentials)
        if cred is None:
            raise RuntimeError("Missing Firebase credentials")
        firebase_admin.initialize_app(cred)

    return firestore.client()


def get_firestore_client():
    global _firestore_client, _initialized, _init_error

    if _initialized:
        return _firestore_client

    _initialized = True

    try:
        _firestore_client = _run_blocking(_init_firestore_client)
        _init_error = None
        return _firestore_client
    except Exception as exc:
        _firestore_client = None
        _init_error = str(exc)
        return None


def persistence_enabled():
    return get_firestore_client() is not None


def persistence_error():
    return _init_error


def load_room_snapshot(room_id: str):
    client = get_firestore_client()
    if not client:
        return None

    try:
        doc = _run_blocking(lambda: client.collection(COLLECTION_NAME).document(room_id).get())
        if not doc.exists:
            return None
        return doc.to_dict() or {}
    except Exception as exc:
        global _init_error
        _init_error = str(exc)
        return None


def save_room_snapshot(room_id: str, snapshot: dict):
    client = get_firestore_client()
    if not client:
        return None

    ts = int(time.time() * 1000)
    payload = dict(snapshot)
    payload["roomId"] = room_id
    payload["savedAt"] = ts
    payload["updatedAt"] = ts

    try:
        _run_blocking(lambda: client.collection(COLLECTION_NAME).document(room_id).set(payload))
        return ts
    except Exception as exc:
        global _init_error
        _init_error = str(exc)
        print(f"[Firebase] Save failed for room {room_id}: {exc}")
        return None
