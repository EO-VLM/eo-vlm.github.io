#!/usr/bin/env python3
"""
Scan data/ for model directories that contain a metadata.json and write
data/models.json — the index consumed by the website's JS.

Run from the repository root:
    python scripts/generate_models.py
"""

import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
OUTPUT = DATA_DIR / "models.json"


def main() -> None:
    if not DATA_DIR.is_dir():
        print(f"ERROR: data directory not found: {DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    slugs = sorted(
        d.name
        for d in DATA_DIR.iterdir()
        if d.is_dir() and (d / "metadata.json").exists()
    )

    OUTPUT.write_text(json.dumps(slugs, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(REPO_ROOT)} with {len(slugs)} model(s):")
    for slug in slugs:
        print(f"  - {slug}")


if __name__ == "__main__":
    main()
