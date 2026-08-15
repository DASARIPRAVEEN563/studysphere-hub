"""Excel export of student records using openpyxl (hashes only, no plaintext)."""
import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

HEADERS = [
    "Full Name",
    "Registration ID",
    "Password Hash",
    "Security Question",
    "Security Answer Hash",
    "Department",
    "Year",
    "Semester",
    "Notes Sharing Count",
    "Downloaded Notes Count",
]


def build_students_workbook(users: list) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Students"
    ws.append(HEADERS)

    header_fill = PatternFill("solid", fgColor="6D28D9")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for user in users:
        ws.append([
            user.get("fullName", ""),
            user.get("registrationId", ""),
            user.get("passwordHash", ""),
            user.get("securityQuestion", ""),
            user.get("securityAnswerHash", ""),
            user.get("department", ""),
            user.get("year", ""),
            user.get("semester", ""),
            int(user.get("sharedCount", 0)),
            int(user.get("downloadedCount", 0)),
        ])

    widths = [26, 18, 60, 34, 60, 16, 12, 12, 20, 24]
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = width
    ws.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()