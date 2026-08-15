from flask import Blueprint

from controllers import profile_controller
from middleware.auth_middleware import require_auth

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

profile_bp.add_url_rule(
    "", view_func=require_auth(profile_controller.get_profile), methods=["GET"]
)
profile_bp.add_url_rule(
    "", view_func=require_auth(profile_controller.update_profile), methods=["PUT"]
)