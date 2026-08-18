import json
import os
import time

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except Exception:
    firebase_admin = None
    credentials = None
    firestore = None

COLLECTION_NAME = os.getenv("FIREBASE_COLLECTION_NAME", "whiteboard_rooms")

_firestore_client = None
_initialized = False
_init_error = None


def _build_credentials():
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    if service_account_path:
        return credentials.Certificate(service_account_path)

    if service_account_json:
        data = json.loads(service_account_json)
        return credentials.Certificate(data)

    

    return None


def get_firestore_client():
    global _firestore_client, _initialized, _init_error

    if _initialized:
        return _firestore_client

    _initialized = True

    if firebase_admin is None or credentials is None or firestore is None:
        _init_error = "firebase-admin is not installed"
        return None

    try:
        if not firebase_admin._apps:
            cred = _build_credentials()
            if cred is None:
                _init_error = "Missing Firebase credentials"
                return None
            firebase_admin.initialize_app(cred)

        _firestore_client = firestore.client()
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
        doc = client.collection(COLLECTION_NAME).document(room_id).get()
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
        client.collection(COLLECTION_NAME).document(room_id).set(payload)
        return ts
    except Exception as exc:
        global _init_error
        _init_error = str(exc)
        print(f"[Firebase] Save failed for room {room_id}: {exc}")
        return None