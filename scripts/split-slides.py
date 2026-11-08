#!/usr/bin/env python3
"""Split pinned Bootlin PDFs according to slides.json without changing the sources."""
import hashlib
import json
from pathlib import Path
import tempfile

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parent.parent
MATERIALS = ROOT / "materials" / "bootlin"


def main():
    decks = json.loads((ROOT / "slides.json").read_text(encoding="utf-8"))["decks"]
    for deck in decks:
        source = MATERIALS / f"{deck['id']}-slides.pdf"
        if hashlib.sha256(source.read_bytes()).hexdigest() != deck["sha256"]:
            raise ValueError(f"Source hash mismatch: {source}")
        reader = PdfReader(source)
        if len(reader.pages) != deck["pages"]:
            raise ValueError(f"Page count mismatch: {source}")
        destination = MATERIALS / "sections" / deck["id"]
        destination.mkdir(parents=True, exist_ok=True)
        expected_start = 1
        for section in deck["sections"]:
            start, end = section["start"], section["end"]
            if start != expected_start or not start <= end <= deck["pages"]:
                raise ValueError(f"Invalid section range: {deck['id']} {start}-{end}")
            writer = PdfWriter()
            for page in reader.pages[start - 1:end]:
                writer.add_page(page)
            writer.add_metadata({
                "/Title": f"{deck['title']} — {section['title']}",
                "/Author": "Bootlin",
                "/Subject": f"Pages {start}-{end} extracted from Bootlin's {deck['id']}-slides.pdf; CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/",
                "/Source": f"https://bootlin.com/doc/training/{deck['id']}/{deck['id']}-slides.pdf",
            })
            output = destination / f"{start}-{end}.pdf"
            with tempfile.NamedTemporaryFile(dir=destination, suffix=".pdf", delete=False) as temp:
                temporary = Path(temp.name)
            try:
                with temporary.open("wb") as temp:
                    writer.write(temp)
                result = PdfReader(temporary)
                if len(result.pages) != end - start + 1:
                    raise ValueError(f"Incorrect extracted page count: {output}")
                temporary.replace(output)
            finally:
                temporary.unlink(missing_ok=True)
            expected_start = end + 1
        if expected_start != deck["pages"] + 1:
            raise ValueError(f"Incomplete coverage: {deck['id']}")
        print(f"{deck['title']}: {len(deck['sections'])} sections written to {destination}")


if __name__ == "__main__":
    main()
