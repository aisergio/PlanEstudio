"""Importa el Excel privado sin dependencias adicionales (Python 3.10+)."""
import argparse
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


def import_books(source):
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(source) as workbook:
        shared = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
        strings = ["".join(piece.text or "" for piece in item.findall(".//s:t", ns)) for item in shared]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
    books = []
    fields = dict(zip("ABCDE", ("title", "author", "topic", "series", "note")))
    for row in sheet.findall(".//s:row", ns):
        if not 7 <= int(row.attrib["r"]) <= 91:
            continue
        book = dict.fromkeys(fields.values(), "")
        for cell in row.findall("s:c", ns):
            column = re.match(r"^[A-Z]+", cell.attrib["r"]).group()
            value = cell.findtext("s:v", default="", namespaces=ns)
            if cell.attrib.get("t") == "s" and value:
                value = strings[int(value)]
            if column in fields:
                book[fields[column]] = value.strip()
        if not book["title"]:
            raise ValueError(f"Falta el título de la fila {row.attrib['r']}.")
        books.append(book)
    if len(books) != 85:
        raise ValueError(f"Se esperaban 85 registros en el Excel, se encontraron {len(books)}.")
    return books


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("excel", type=Path)
    args = parser.parse_args()
    books = import_books(args.excel)
    output = Path(__file__).resolve().parents[1] / ".private" / "library.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(books)} registros importados a {output}")
