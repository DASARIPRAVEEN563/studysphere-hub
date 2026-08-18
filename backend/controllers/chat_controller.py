from flask import g, jsonify, request

from models import store


def _message(user_id: str, sender: str, text: str, image: str | None = None) -> dict:
    return {
        "id": store.new_id(),
        "userId": user_id,
        "from": sender,
        "text": text,
        "image": image,
        "createdAt": store.now_iso(),
    }


def _image(data: dict) -> str | None:
    """Accepts a small inline data-URL image attachment."""
    image = data.get("image")
    if isinstance(image, str) and image.startswith("data:image/") and len(image) < 400_000:
        return image
    return None


def list_messages():
    rows = [m for m in store.read("chats") if m.get("userId") == g.user["id"]]
    rows.sort(key=lambda m: m.get("createdAt", ""))
    return jsonify({"messages": rows})


def send_message():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    image = _image(data)
    if not text and not image:
        return jsonify({"error": "Message is empty"}), 400
    sender = "admin" if g.user.get("role") == "admin" else "user"
    message = store.insert("chats", _message(g.user["id"], sender, text, image))
    return jsonify({"message": message}), 201


def admin_threads():
    chats = store.read("chats")
    threads = []
    for user in store.read("users"):
        if user.get("role") == "admin":
            continue
        messages = sorted(
            (m for m in chats if m.get("userId") == user["id"]),
            key=lambda m: m.get("createdAt", ""),
        )
        if not messages:
            continue
        threads.append(
            {
                "userId": user["id"],
                "fullName": user.get("fullName"),
                "registrationId": user.get("registrationId"),
                "department": user.get("department"),
                "year": user.get("year"),
                "semester": user.get("semester"),
                "profilePicture": user.get("profilePicture"),
                "messages": messages,
            }
        )
    return jsonify({"threads": threads})


def admin_reply(user_id: str):
    if not store.find("users", id=user_id):
        return jsonify({"error": "Student not found"}), 404
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    image = _image(data)
    if not text and not image:
        return jsonify({"error": "Message is empty"}), 400
    message = store.insert("chats", _message(user_id, "admin", text, image))
    return jsonify({"message": message}), 201

def admin_broadcast():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Message is empty"}), 400
    sent = 0
    for user in store.read("users"):
        if user.get("role") == "admin":
            continue
        store.insert("chats", _message(user["id"], "admin", text))
        sent += 1
    return jsonify({"sent": sent}), 201
