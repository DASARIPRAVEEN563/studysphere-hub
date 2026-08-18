"""User shaping helpers - never leak password or security answer hashes."""

PUBLIC_FIELDS = (
    "id",
    "fullName",
    "registrationId",
    "email",
    "department",
    "year",
    "semester",
    "role",
    "profilePicture",
    "sharedCount",
    "downloadedCount",
    "stars",
    "faceVerified",
    "faceImage",
    "faceVerifiedAt",
    "identityConfirmed",
)


def public_user(user: dict) -> dict:
    return {key: user.get(key) for key in PUBLIC_FIELDS}