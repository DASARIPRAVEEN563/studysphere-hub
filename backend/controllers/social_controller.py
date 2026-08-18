"""Like notifications and the sharing leaderboard."""
from flask import g, jsonify

from models import store


def list_notifications():
    rows = [n for n in store.read("notifications") if n.get("userId") == g.user["id"]]
    rows.sort(key=lambda n: n.get("createdAt", ""), reverse=True)
    return jsonify({"notifications": rows[:30]})


def mark_read():
    rows = store.read("notifications")
    for row in rows:
        if row.get("userId") == g.user["id"]:
            row["read"] = True
    store.write("notifications", rows)
    return jsonify({"ok": True})


def leaderboard():
    notes = store.read("notes")
    leaders = []
    for user in store.read("users"):
        if user.get("role") == "admin":
            continue
        mine = [n for n in notes if n.get("uploadedById") == user["id"]]
        leaders.append(
            {
                "id": user["id"],
                "fullName": user.get("fullName"),
                "registrationId": user.get("registrationId"),
                "department": user.get("department"),
                "shares": len(mine),
                "likes": sum(len(n.get("likedBy") or []) for n in mine),
            }
        )
    return jsonify({"leaders": leaders})
