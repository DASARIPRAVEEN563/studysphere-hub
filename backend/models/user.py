"""User shaping helpers - never leak password or security answer hashes."""

PUBLIC_FIELDS = (
    "id",
    "fullName",
    "registrationId",
    "department",
    "year",
    "semester",
    "role",
    "profilePicture",
    "sharedCount",
    "downloadedCount",
)


def public_user(user: dict) -> dict:
    return {key: user.get(key) for key in PUBLIC_FIELDS}