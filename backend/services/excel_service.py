"""Excel export of student records using openpyxl (no credentials of any kind)."""
import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

HEADERS = [
    "Full Name",
    "Email ID",
    "Registration ID",
    "Department",
    "Year",
    "Semester",
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
            user.get("email", "") or "",
            user.get("registrationId", ""),
            user.get("department", ""),
            user.get("year", ""),
            user.get("semester", ""),
        ])

    widths = [26, 30, 18, 16, 12, 12]
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = width
    ws.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
