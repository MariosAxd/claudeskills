"""Server-side configuration: reads config.json from the parent codesearch directory."""

import json
import os
import re as _re

HOST = "localhost"

# config.json lives one level up (codesearch/config.json)
_CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json"
)


def _read_config() -> dict:
    try:
        with open(_CONFIG_FILE) as _f:
            return json.load(_f)
    except (OSError, json.JSONDecodeError):
        return {}


_CONFIG = _read_config()

if "port" not in _CONFIG:
    raise RuntimeError(f"'port' is required in {_CONFIG_FILE}")
PORT: int = int(_CONFIG["port"])
API_KEY: str = _CONFIG.get("api_key", "codesearch-local")

# ── Roots ─────────────────────────────────────────────────────────────────────
_raw_roots: dict = _CONFIG.get("roots") or {"default": _CONFIG.get("src_root", "")}

ROOTS: dict[str, str] = {
    name: path.replace("\\", "/").rstrip("/")
    for name, path in _raw_roots.items()
}

SRC_ROOT: str = ROOTS.get("default") or next(iter(ROOTS.values()), "")


def _sanitize_root_name(name: str) -> str:
    return _re.sub(r"[^a-z0-9_]", "_", name.lower())


def collection_for_root(name: str = "default") -> str:
    return f"codesearch_{_sanitize_root_name(name)}"


def get_root(name: str = "") -> tuple[str, str]:
    """Resolve root name → (collection_name, src_path). Empty = first root."""
    if not name:
        name = "default" if "default" in ROOTS else next(iter(ROOTS))
    if name not in ROOTS:
        raise ValueError(f"Unknown root {name!r}. Available: {sorted(ROOTS)}")
    return collection_for_root(name), ROOTS[name]


_default_root_name = "default" if "default" in ROOTS else next(iter(ROOTS), "default")
COLLECTION: str = collection_for_root(_default_root_name)

TYPESENSE_VERSION = "27.1"

INCLUDE_EXTENSIONS = {
    ".cs",
    ".cpp", ".c", ".h", ".hpp", ".idl",
    ".dsc", ".inc", ".props", ".targets", ".csproj",
    ".py", ".sh", ".cmd", ".bat", ".ps1",
    ".ts", ".js", ".json", ".xml", ".yaml", ".yml",
    ".md", ".txt",
    ".sql",
}

EXCLUDE_DIRS = {
    "Target", "Build", "Import", "nugetcache",
    ".git", "obj", "bin", "node_modules", ".venv",
    "target", "debug", "ship", "x64", "x86",
    "__pycache__", ".vs",
}

MAX_FILE_BYTES = 512 * 1024
MAX_CONTENT_CHARS = 30000

TYPESENSE_CLIENT_CONFIG = {
    "nodes": [{"host": HOST, "port": str(PORT), "protocol": "http"}],
    "api_key": API_KEY,
    "connection_timeout_seconds": 5,
}
