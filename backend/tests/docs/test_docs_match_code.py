import ast
import glob
import os
import re

ALLOW_LIST = {
    # Technologies / External libraries
    "FastAPI",
    "SQLAlchemy",
    "SQLite",
    "PostgreSQL",
    "Pydantic",
    "React",
    "Vite",
    "Tailwind",
    "Recharts",
    "TypeScript",
    "Node",
    "Python",
    "Celery",
    "Redis",
    "Twilio",
    "SendGrid",
    "QuickBooks",
    "FreshBooks",
    "Mermaid",
    "PlantUML",
    "Decimal",
    "UUID",
    "Session",
    "DictReader",
    # Specific architectural/OOAD terms or hypothetical extensibility examples in report notes
    "BankDetailsUpdateResolution",
    "PromiseRiskStrategy",
    "LegalNoticeReminder",
    "JsonInvoiceSource",
    "TaxWithholdingResolution",
    "ProjectGroupedStrategy",
    "RecordPaymentCommand",
    "ResolveBlockerCommand",
    "LateFeePolicy",
    "FixedLateFee",
    "PercentageLateFee",
    "BANK_DETAILS_UPDATE",
    "LEGAL_NOTICE",
    "FINAL_NOTICE",
    "DuePing",
    "Command",  # Design pattern mentioned in future work
    "SIMULATED",  # UI badge text
    "OVERDUE",  # Mentioned in deviations as omitted state
    "GENTLE",  # Mentioned in deviations as omitted tone
    "CollectionService",  # Naive design flaw analyzed in report notes
    "PersistencePort",  # Monolithic anti-pattern analyzed in ISP section
}


def test_docs_match_code() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    app_dir = os.path.join(repo_root, "backend", "app")

    defined_names: set[str] = set()
    for root, _, files in os.walk(app_dir):
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8") as fp:
                    tree = ast.parse(fp.read(), filename=path)
                for node in ast.walk(tree):
                    if isinstance(node, (ast.ClassDef, ast.FunctionDef)):
                        defined_names.add(node.name)
                        # Also collect class attributes (e.g. enum members)
                        if isinstance(node, ast.ClassDef):
                            for item in node.body:
                                if isinstance(item, ast.Assign):
                                    for target in item.targets:
                                        if isinstance(target, ast.Name):
                                            defined_names.add(target.id)
                                elif isinstance(item, ast.AnnAssign):
                                    if isinstance(item.target, ast.Name):
                                        defined_names.add(item.target.id)
                    elif isinstance(node, ast.Assign):
                        for target in node.targets:
                            if isinstance(target, ast.Name):
                                defined_names.add(target.id)

    # Collect documentation files
    doc_files = glob.glob(os.path.join(repo_root, "docs", "**", "*.md"), recursive=True)
    readme = os.path.join(repo_root, "README.md")
    if os.path.exists(readme):
        doc_files.append(readme)

    mermaid_class_re = re.compile(r"^\s*class\s+([A-Za-z0-9_]+)", re.MULTILINE)
    backtick_camel_re = re.compile(r"`([A-Z][a-zA-Z0-9_]+)`")

    unknown_identifiers: dict[str, list[str]] = {}

    for doc_path in doc_files:
        rel_path = os.path.relpath(doc_path, repo_root)
        with open(doc_path, "r", encoding="utf-8") as fp:
            content = fp.read()

        extracted: set[str] = set()
        for m in mermaid_class_re.finditer(content):
            extracted.add(m.group(1))

        for m in backtick_camel_re.finditer(content):
            extracted.add(m.group(1))

        for name in extracted:
            if name not in defined_names and name not in ALLOW_LIST:
                unknown_identifiers.setdefault(name, []).append(rel_path)

    assert not unknown_identifiers, (
        f"Found {len(unknown_identifiers)} unknown identifiers in docs/README that do not exist in backend/app:\n"
        + "\n".join(f"  - {k} (found in: {', '.join(v)})" for k, v in sorted(unknown_identifiers.items()))
    )
