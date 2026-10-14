#!/usr/bin/env python3

from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent

REPLACEMENTS = {
    "starter-admin": "Admin",
    "starter-developer": "Developer",
    "starter-viewer": "Viewer",
    "AIStarter-Admin-Local-7Qm4!pR9": "password",
    "StarterDev123!": "password",
    "StarterView123!": "password",
}

SEARCH_DIRS = [
    ROOT / "scripts",
    ROOT / "docs",
    ROOT / "keycloak",
    ROOT / "frontend",
    ROOT / "backend",
]

ROOT_FILES = [
    ROOT / "README.md",
]

EXCLUDED = {
    Path(__file__).resolve(),
}

EXTENSIONS = {
    ".sh",
    ".md",
    ".json",
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".yaml",
    ".yml",
    ".txt",
}

def collect_files():
    files = set()

    for directory in SEARCH_DIRS:
        if not directory.is_dir():
            continue

        for path in directory.rglob("*"):
            if not path.is_file():
                continue

            if path.resolve() in EXCLUDED:
                continue

            if any(
                part in {".git", "node_modules", ".next"}
                for part in path.parts
            ):
                continue

            if path.suffix in EXTENSIONS:
                files.add(path)

    for path in ROOT_FILES:
        if path.is_file():
            files.add(path)

    return sorted(files)

def main():
    files = collect_files()
    original_contents = {}
    total_counts = {old: 0 for old in REPLACEMENTS}

    for path in files:
        try:
            content = path.read_text()
        except UnicodeDecodeError:
            continue

        original_contents[path] = content

        for old in REPLACEMENTS:
            total_counts[old] += content.count(old)

    print("\n========== Local Demo Credential Update ==========")

    for old, new in REPLACEMENTS.items():
        print(f"{old} -> {new} ({total_counts[old]} occurrence(s))")

    missing = [
        value for value, count in total_counts.items()
        if count == 0
    ]

    if missing:
        print("\nERROR: Expected values were not found:")
        for value in missing:
            print(f"  - {value}")
        print("\nNo files were changed.")
        return 1

    changes = {}

    for path, original in original_contents.items():
        updated = original

        for old, new in REPLACEMENTS.items():
            updated = updated.replace(old, new)

        if updated != original:
            changes[path] = updated

    if not changes:
        print("\nNo changes are necessary.")
        return 0

    print("\nFiles that will change:")
    for path in changes:
        print(f"  - {path.relative_to(ROOT)}")

    print("\nBackups will be saved in a timestamped directory.")
    print("Type UPDATE to confirm.")
    confirmation = input("> ").strip()

    if confirmation != "UPDATE":
        print("Cancelled. No files were changed.")
        return 0

    backup_dir = ROOT / (
        ".local-demo-credentials-backup-"
        + datetime.now().strftime("%Y%m%d-%H%M%S")
    )

    backup_dir.mkdir()

    try:
        for path, updated in changes.items():
            relative = path.relative_to(ROOT)
            backup = backup_dir / relative
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_text(original_contents[path])

        for path, updated in changes.items():
            path.write_text(updated)

    except Exception as error:
        print(f"\nERROR: Update failed: {error}", file=sys.stderr)
        print(f"Original backups are in: {backup_dir}", file=sys.stderr)
        print(
            "Inspect the files and backups before retrying.",
            file=sys.stderr,
        )
        return 1

    print("\nCredential references updated successfully.")
    print(f"Backups: {backup_dir.relative_to(ROOT)}")
    print("\nNext, inspect the diff and run the validation checks.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
