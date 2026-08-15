from flask import Blueprint

from controllers import chat_controller
from middleware.auth_middleware import require_auth

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

chat_bp.add_url_rule("", view_func=require_auth(chat_controller.list_messages), methods=["GET"])
chat_bp.add_url_rule(
    "", view_func=require_auth(chat_controller.send_message), methods=["POST"],
    endpoint="send_message",
)