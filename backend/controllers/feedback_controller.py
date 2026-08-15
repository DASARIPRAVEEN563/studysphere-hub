from flask import g, jsonify, request

from models import store


def list_feedback():
    rows = sorted(store.read("feedback"), key=lambda r: r.get("createdAt", ""), reverse=True)
    return jsonify({"feedback": rows})


def create_feedback():
    data = request.get_json(silent=True) or {}
    try:
        rating = int(data.get("rating", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Rating must be a number"}), 400
    if rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be between 1 and 5"}), 400
    comment = (data.get("comment") or "").strip()
    if not comment:
        return jsonify({"error": "Comment is required"}), 400
    item = {
        "id": store.new_id(),
        "userId": g.user["id"],
        "userName": g.user["fullName"],
        "registrationId": g.user["registrationId"],
        "rating": rating,
        "comment": comment,
        "createdAt": store.now_iso(),
    }
    store.insert("feedback", item)
    return jsonify({"item": item}), 201