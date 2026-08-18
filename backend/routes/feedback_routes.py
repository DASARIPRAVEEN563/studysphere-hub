from flask import Blueprint

from controllers import feedback_controller
from middleware.auth_middleware import require_auth

feedback_bp = Blueprint("feedback", __name__, url_prefix="/api/feedback")

feedback_bp.add_url_rule(
    "", view_func=require_auth(feedback_controller.list_feedback), methods=["GET"]
)
feedback_bp.add_url_rule(
    "",
    view_func=require_auth(feedback_controller.create_feedback),
    methods=["POST"],
    endpoint="create_feedback",
)feedback_bp.add_url_rule(
    "/mine", view_func=require_auth(feedback_controller.my_feedback), methods=["GET"]
)
