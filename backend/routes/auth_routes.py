from flask import Blueprint

from controllers import auth_controller

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

auth_bp.add_url_rule("/signup", view_func=auth_controller.signup, methods=["POST"])
auth_bp.add_url_rule("/login", view_func=auth_controller.login, methods=["POST"])
auth_bp.add_url_rule("/forgot/question", view_func=auth_controller.forgot_question, methods=["POST"])
auth_bp.add_url_rule("/forgot/reset", view_func=auth_controller.forgot_reset, methods=["POST"])