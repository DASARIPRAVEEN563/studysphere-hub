"""STUDENTS KA NOTES SHARING HUB - Flask API server."""
import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

load_dotenv()

from models import store  # noqa: E402
from routes.admin_routes import admin_bp, content_bp  # noqa: E402
from routes.auth_routes import auth_bp  # noqa: E402
from routes.notes_routes import notes_bp  # noqa: E402
from routes.profile_routes import profile_bp  # noqa: E402
from services import drive_service  # noqa: E402
from services.security_service import hash_value  # noqa: E402


def ensure_admin() -> None:
    registration_id = os.environ.get("ADMIN_ID", "ADMIN001").upper()
    if store.find("users", registrationId=registration_id):
        return
    store.insert(
        "users",
        {
            "id": store.new_id(),
            "fullName": os.environ.get("ADMIN_NAME", "Portal Administrator"),
            "registrationId": registration_id,
            "passwordHash": hash_value(os.environ.get("ADMIN_PASSWORD", "Admin@12345")),
            "securityQuestion": "What is your nickname?",
            "securityAnswerHash": hash_value("admin"),
            "department": "CSE",
            "year": "1 Year",
            "semester": "1 Sem",
            "role": "admin",
            "profilePicture": None,
            "sharedCount": 0,
            "downloadedCount": 0,
            "createdAt": store.now_iso(),
        },
    )
    print(f"[init] Admin account created: {registration_id}")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_UPLOAD_MB", "25")) * 1024 * 1024

    origins = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Disposition"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(content_bp)

    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "STUDENTS KA NOTES SHARING HUB",
                "googleDrive": drive_service.drive_enabled(),
            }
        )

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(413)
    def too_large(_err):
        return jsonify({"error": "File is too large"}), 413

    @app.errorhandler(Exception)
    def server_error(err):
        app.logger.exception(err)
        return jsonify({"error": "Internal server error"}), 500

    ensure_admin()
    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "1") == "1")