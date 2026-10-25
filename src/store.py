import csv
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / "litter.csv"
FIELDS = ["type", "longitude", "latitude"]


def add(record):
    new_file = not FILE.exists()
    with open(FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        writer.writerow({field: record.get(field, "") for field in FIELDS})
    return record


def all():
    if not FILE.exists():
        return []
    with open(FILE, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def update(index, record):
    rows = all()
    rows[index] = {field: record.get(field, "") for field in FIELDS}
    _write(rows)
    return rows[index]


def delete(index):
    rows = all()
    rows.pop(index)
    _write(rows)


def _write(rows):
    with open(FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
