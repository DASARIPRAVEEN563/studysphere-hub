from flask import Blueprint

from controllers import notes_controller
from middleware.auth_middleware import require_auth

notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")

notes_bp.add_url_rule("", view_func=require_auth(notes_controller.list_notes), methods=["GET"])
notes_bp.add_url_rule(
    "/upload", view_func=require_auth(notes_controller.upload_note), methods=["POST"]
)
notes_bp.add_url_rule(
    "/<note_id>/download",
    view_func=require_auth(notes_controller.download_note),
    methods=["GET"],
)
notes_bp.add_url_rule(
    "/<note_id>/view", view_func=require_auth(notes_controller.view_note), methods=["GET"]
)
notes_bp.add_url_rule(
    "/<note_id>/like", view_func=require_auth(notes_controller.like_note), methods=["POST"]
)
notes_bp.add_url_rule(
    "/<note_id>",
    view_func=require_auth(notes_controller.update_own_note),
    methods=["PUT"],
    endpoint="update_own_note",
)
notes_bp.add_url_rule(
    "/<note_id>",
    view_func=require_auth(notes_controller.delete_own_note),
    methods=["DELETE"],
    endpoint="delete_own_note",
)
