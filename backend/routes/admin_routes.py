from flask import Blueprint

from controllers import admin_controller, chat_controller, feedback_controller
from middleware.auth_middleware import require_admin

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
content_bp = Blueprint("content", __name__, url_prefix="/api/content")

# Public (any visitor) read of home content
content_bp.add_url_rule("", view_func=admin_controller.list_content, methods=["GET"])

admin_bp.add_url_rule(
    "/notes", view_func=require_admin(admin_controller.admin_list_notes), methods=["GET"]
)
admin_bp.add_url_rule(
    "/notes/<note_id>",
    view_func=require_admin(admin_controller.admin_update_note),
    methods=["PATCH"],
)
admin_bp.add_url_rule(
    "/notes/<note_id>",
    view_func=require_admin(admin_controller.admin_delete_note),
    methods=["DELETE"],
    endpoint="admin_delete_note",
)
admin_bp.add_url_rule(
    "/content", view_func=require_admin(admin_controller.create_content), methods=["POST"]
)
admin_bp.add_url_rule(
    "/content/<content_id>",
    view_func=require_admin(admin_controller.update_content),
    methods=["PATCH"],
)
admin_bp.add_url_rule(
    "/content/<content_id>",
    view_func=require_admin(admin_controller.delete_content),
    methods=["DELETE"],
    endpoint="admin_delete_content",
)
admin_bp.add_url_rule(
    "/students.xlsx",
    view_func=require_admin(admin_controller.export_students_xlsx),
    methods=["GET"],
)
admin_bp.add_url_rule(
    "/students", view_func=require_admin(admin_controller.list_students), methods=["GET"]
)
admin_bp.add_url_rule(
    "/students/<user_id>",
    view_func=require_admin(admin_controller.delete_student),
    methods=["DELETE"],
    endpoint="admin_delete_student",
)
admin_bp.add_url_rule(
    "/chat", view_func=require_admin(chat_controller.admin_threads), methods=["GET"]
)
admin_bp.add_url_rule(
    "/chat/<user_id>",
    view_func=require_admin(chat_controller.admin_reply),
    methods=["POST"],
    endpoint="admin_chat_reply",
)
admin_bp.add_url_rule(
    "/feedback", view_func=require_admin(feedback_controller.list_feedback), methods=["GET"]
)