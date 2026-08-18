from flask import Blueprint

from controllers import social_controller
from middleware.auth_middleware import require_auth

social_bp = Blueprint("social", __name__, url_prefix="/api")

social_bp.add_url_rule(
    "/notifications", view_func=require_auth(social_controller.list_notifications), methods=["GET"]
)
social_bp.add_url_rule(
    "/notifications",
    view_func=require_auth(social_controller.mark_read),
    methods=["POST"],
    endpoint="mark_notifications_read",
)
social_bp.add_url_rule(
    "/leaderboard", view_func=require_auth(social_controller.leaderboard), methods=["GET"]
)
