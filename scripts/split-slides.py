#!/usr/bin/env python3
"""Split the pinned Bootlin slide decks and lab manuals without changing the sources."""
import hashlib
import json
from pathlib import Path
import re
import tempfile

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parent.parent
MATERIALS = ROOT / "materials" / "bootlin"


def pinned_reader(source, record):
    if hashlib.sha256(source.read_bytes()).hexdigest() != record["sha256"]:
        raise ValueError(f"Source hash mismatch: {source}")
    reader = PdfReader(source)
    if len(reader.pages) != record["pages"]:
        raise ValueError(f"Page count mismatch: {source}")
    return reader


def split_pdf(reader, entries, destination, first_page, title, source, url):
    expected_start = first_page
    for entry in entries:
        start, end = entry["start"], entry["end"]
        if start != expected_start or not start <= end <= len(reader.pages):
            raise ValueError(f"Invalid page range: {source} {start}-{end}")
        expected_start = end + 1
    if expected_start != len(reader.pages) + 1:
        raise ValueError(f"Incomplete coverage: {source}")

    destination.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        start, end = entry["start"], entry["end"]
        writer = PdfWriter()
        for page in reader.pages[start - 1:end]:
            writer.add_page(page)
        writer.add_metadata({
            "/Title": f"{title} — {entry['title']}",
            "/Author": "Bootlin",
            "/Subject": f"Pages {start}-{end} extracted from Bootlin's {source}; CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/",
            "/Source": url,
        })
        output = destination / f"{start}-{end}.pdf"
        with tempfile.NamedTemporaryFile(dir=destination, suffix=".pdf", delete=False) as temp:
            temporary = Path(temp.name)
        try:
            with temporary.open("wb") as temp:
                writer.write(temp)
            if len(PdfReader(temporary).pages) != end - start + 1:
                raise ValueError(f"Incorrect extracted page count: {output}")
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)

    expected = {f"{entry['start']}-{entry['end']}.pdf" for entry in entries}
    for stale in destination.glob("*.pdf"):
        if re.fullmatch(r"\d+-\d+\.pdf", stale.name) and stale.name not in expected:
            stale.unlink()
    print(f"{title}: {len(entries)} PDFs written to {destination}")


def main():
    decks = json.loads((ROOT / "slides.json").read_text(encoding="utf-8"))["decks"]
    labs = json.loads((ROOT / "labs.json").read_text(encoding="utf-8"))["labs"]
    for deck in decks:
        filename = f"{deck['id']}-slides.pdf"
        split_pdf(pinned_reader(MATERIALS / filename, deck), deck["sections"],
                  MATERIALS / "sections" / deck["id"], 1, deck["title"], filename,
                  f"https://bootlin.com/doc/training/{deck['id']}/{filename}")
    for lab in labs:
        deck = next(deck for deck in decks if deck["id"] == lab["id"])
        title = f"{deck['title']} ({lab['board']})"
        reader = pinned_reader(MATERIALS / lab["file"], lab)
        starts = [reader.get_destination_page_number(item) + 1
                  for item in reader.outline if not isinstance(item, list)]
        if [page for page in starts if page >= 3] != [entry["start"] for entry in lab["exercises"]]:
            raise ValueError(f"Exercise starts do not match the manual outline: {lab['file']}")
        split_pdf(reader, lab["exercises"], MATERIALS / "exercises" / lab["id"], 3,
                  title, lab["file"], lab["source"])


if __name__ == "__main__":
    main()
