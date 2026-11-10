"""Ensure domain package imports nothing outside stdlib."""
import ast
from pathlib import Path

FORBIDDEN = [
    "fastapi",
    "sqlalchemy",
    "pydantic",
    "app.application",
    "app.infrastructure",
    "app.api",
]


def test_domain_has_no_forbidden_imports():
    domain_dir = Path(__file__).parent.parent.parent / "app" / "domain"
    errors = []
    for py_file in sorted(domain_dir.glob("**/*.py")):
        source = py_file.read_text()
        try:
            tree = ast.parse(source, filename=str(py_file))
        except SyntaxError:
            errors.append(f"{py_file.name}: SyntaxError")
            continue
        for node in ast.walk(tree):
            module_name = None
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module_name = alias.name
                    for forbidden in FORBIDDEN:
                        if module_name == forbidden or module_name.startswith(forbidden + "."):
                            errors.append(f"{py_file.name}: imports {module_name!r}")
            elif isinstance(node, ast.ImportFrom) and node.module:
                module_name = node.module
                for forbidden in FORBIDDEN:
                    if module_name == forbidden or module_name.startswith(forbidden + "."):
                        errors.append(f"{py_file.name}: imports {module_name!r}")
    assert not errors, "Domain imports forbidden modules:\n" + "\n".join(errors)

