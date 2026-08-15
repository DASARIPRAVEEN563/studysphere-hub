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