"""
Structural C# AST query tool powered by tree-sitter.

Use instead of grep when you need semantically precise searches that understand
C# syntax: distinguishes type references from method calls, skips comments and
string literals, understands inheritance hierarchies.

Usage:
    query.py MODE [OPTIONS] FILE [FILE ...] [GLOB_PATTERN ...]

Modes (pick exactly one):
    --classes              List all type declarations with their base types
    --methods              List all method/constructor/property/field signatures
    --fields               List all field and property declarations with types
    --calls    METHOD      Find every call site of METHOD (ignores comments/strings)
    --implements TYPE      Find type declarations that inherit or implement TYPE
    --uses     TYPE        Find every place TYPE is referenced as a type
    --field-type TYPE      Find fields/properties declared with the given type
    --param-type TYPE      Find method/constructor parameters typed as TYPE
    --casts    TYPE        Find every explicit cast expression (TYPE)expr
    --ident    NAME        Find every identifier occurrence (semantic grep — skips comments/strings)
    --attrs    [NAME]      List [Attribute] decorators, optionally filter by NAME
    --usings               List all using/using-alias directives
    --find     NAME        Print the full source of method/type/property named NAME
    --params   METHOD      Show the full parameter list of METHOD

Options:
    --no-path              Don't prefix output with file path (auto for single file)
    --count                Print only match counts per file + total

Examples:
    query.py --methods ItemProcessor.cs
    query.py --calls DeleteItems "$SRC_ROOT/myapp/**/*.cs"
    query.py --implements IStorageProvider "$SRC_ROOT/myapp/**/*.cs"
    query.py --uses StorageProvider "$SRC_ROOT/myapp/services/**/*.cs"
    query.py --field-type StorageProvider --search "StorageProvider"
    query.py --field-type IStorageProvider --search "IStorageProvider"
    query.py --param-type StorageProvider --search "StorageProvider"
    query.py --find Process ItemProcessor.cs
    query.py --classes --no-path IStorageProvider.cs
    query.py --attrs TestMethod "$SRC_ROOT/myapp/tests/**/*.cs"
    query.py --params DeleteItems StorageApi.cs
"""

import os
import re
import sys
import glob as _glob
import argparse
import json as _json
import urllib.request
import urllib.parse

_util_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _util_dir)

import tree_sitter_c_sharp as tscsharp
from tree_sitter import Language, Parser


def _ts_search(collection: str, params: dict) -> dict:
    """Send a search request to Typesense over HTTP (no typesense package needed)."""
    from codesearch.config import HOST, PORT, API_KEY
    qs = urllib.parse.urlencode({k: str(v) for k, v in params.items()})
    url = f"http://{HOST}:{PORT}/collections/{collection}/documents/search?{qs}"
    req = urllib.request.Request(url, headers={"X-TYPESENSE-API-KEY": API_KEY})
    with urllib.request.urlopen(req, timeout=10) as r:
        return _json.loads(r.read())

CS = Language(tscsharp.language())
_parser = Parser(CS)

# ── AST helpers ───────────────────────────────────────────────────────────────

def _find_all(node, predicate, results=None):
    if results is None:
        results = []
    if predicate(node):
        results.append(node)
    for child in node.children:
        _find_all(child, predicate, results)
    return results


def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _line(node) -> str:
    """1-based line number string."""
    return str(node.start_point[0] + 1)


def _strip_generic(name: str) -> str:
    """'IFoo<T, U>' → 'IFoo'"""
    idx = name.find("<")
    return name[:idx].strip() if idx >= 0 else name.strip()


def _unqualify(name: str) -> str:
    """Strip namespace prefix: 'A.B.IFoo' → 'IFoo'."""
    return name.rsplit(".", 1)[-1]


_QUALIFIED_RE = re.compile(r'(?:[A-Za-z_]\w*\.)+([A-Za-z_]\w*)')


def _unqualify_type(text: str) -> str:
    """Strip namespace prefixes from all qualified names in a type string."""
    return _QUALIFIED_RE.sub(r'\1', text)


def _type_names(type_txt: str) -> set:
    """All unqualified type names that appear in a (possibly generic) type string.

    'IList<Acme.IFoo>'  → {'IList', 'IFoo'}
    'Dictionary<string, IFoo>'        → {'Dictionary', 'string', 'IFoo'}
    'IBlobStore'                      → {'IBlobStore'}
    """
    return set(re.findall(r'[A-Za-z_]\w*', _unqualify_type(type_txt)))


_TYPE_DECL_NODES = {
    "class_declaration", "interface_declaration", "struct_declaration",
    "enum_declaration", "record_declaration", "delegate_declaration",
}

_MEMBER_DECL_NODES = {
    "method_declaration", "constructor_declaration", "property_declaration",
    "field_declaration", "event_declaration", "local_function_statement",
}

_LITERAL_NODES = {
    "comment", "string_literal", "verbatim_string_literal",
    "interpolated_string_expression", "character_literal",
    "interpolated_verbatim_string_expression",
}


def _in_literal(node) -> bool:
    p = node.parent
    while p:
        if p.type in _LITERAL_NODES:
            return True
        p = p.parent
    return False


def _field_type(node, src) -> str:
    """Get the type text of a field_declaration (type lives on variable_declaration child)."""
    for child in node.children:
        if child.type == "variable_declaration":
            t = child.child_by_field_name("type")
            if t:
                return _text(t, src).strip()
    return ""


def _base_type_names(node, src) -> list:
    """Extract all type names from the base_list of a type declaration.

    In tree-sitter-c-sharp 0.23.x, base_list is a direct child (no named field),
    and its contents are identifier/generic_name/qualified_name nodes — NOT wrapped
    in simple_base_type as in earlier grammar versions.
    """
    names = []
    # Find base_list by child type — child_by_field_name("bases") is None in 0.23.x
    base_list = next((c for c in node.children if c.type == "base_list"), None)
    if not base_list:
        return names
    for child in base_list.children:
        if not child.is_named:
            continue  # skip punctuation (: and ,)
        if child.type == "identifier":
            names.append(_text(child, src).strip())
        elif child.type == "generic_name":
            # IFoo<T> — first named child is the bare identifier
            if child.named_children:
                names.append(_text(child.named_children[0], src).strip())
        elif child.type == "qualified_name":
            # Microsoft.Ns.IBar — keep full qualified text for matching
            names.append(_text(child, src).strip())
        elif child.type in ("simple_base_type", "primary_constructor_base_type"):
            # Older grammar versions wrapped types in simple_base_type
            t = child.child_by_field_name("type") or child.child_by_field_name("name")
            if t:
                names.append(_text(t, src).strip())
            elif child.named_children:
                names.append(_text(child.named_children[0], src).strip())
    return names


def _build_sig(node, src) -> str:
    """Build 'RetType Name(Type param, ...)' for a method/ctor node."""
    ret   = node.child_by_field_name("type")
    name  = node.child_by_field_name("name")
    params = node.child_by_field_name("parameters")

    if not name:
        return ""

    ret_txt  = _text(ret, src).strip() if ret else ""
    name_txt = _text(name, src).strip()

    if params:
        parts = []
        for p in _find_all(params, lambda n: n.type == "parameter"):
            pt = p.child_by_field_name("type")
            pn = p.child_by_field_name("name")
            pt_txt = _text(pt, src).strip() if pt else ""
            pn_txt = _text(pn, src).strip() if pn else ""
            parts.append(f"{pt_txt} {pn_txt}".strip())
        params_txt = ", ".join(parts)
    else:
        params_txt = ""

    return f"{ret_txt} {name_txt}({params_txt})".strip() if ret_txt else f"{name_txt}({params_txt})"


# ── Query functions ───────────────────────────────────────────────────────────

def q_classes(src, tree, lines):
    results = []
    for node in _find_all(tree.root_node, lambda n: n.type in _TYPE_DECL_NODES):
        name_node = node.child_by_field_name("name")
        if not name_node:
            continue
        kind  = node.type.replace("_declaration", "").replace("_", " ")
        name  = _text(name_node, src)
        bases = _base_type_names(node, src)
        suffix = f" : {', '.join(bases)}" if bases else ""
        results.append((_line(node), f"[{kind}] {name}{suffix}"))
    return results


def q_methods(src, tree, lines):
    results = []
    for node in _find_all(tree.root_node, lambda n: n.type in _MEMBER_DECL_NODES):
        ln = _line(node)
        if node.type == "field_declaration":
            type_txt = _field_type(node, src)
            for var in _find_all(node, lambda n: n.type == "variable_declarator"):
                vn = var.child_by_field_name("name")
                if vn:
                    results.append((ln, f"[field]  {type_txt} {_text(vn, src)}"))
        elif node.type == "property_declaration":
            type_node = node.child_by_field_name("type")
            name_node = node.child_by_field_name("name")
            if name_node:
                type_txt = _text(type_node, src).strip() if type_node else ""
                results.append((ln, f"[prop]   {type_txt} {_text(name_node, src)}"))
        elif node.type == "event_declaration":
            type_node = node.child_by_field_name("type")
            name_node = node.child_by_field_name("name")
            if name_node:
                type_txt = _text(type_node, src).strip() if type_node else ""
                results.append((ln, f"[event]  {type_txt} {_text(name_node, src)}"))
        elif node.type in ("method_declaration", "local_function_statement"):
            sig = _build_sig(node, src)
            if sig:
                results.append((ln, f"[method] {sig}"))
        elif node.type == "constructor_declaration":
            sig = _build_sig(node, src)
            if sig:
                results.append((ln, f"[ctor]   {sig}"))
    return results


def q_fields(src, tree, lines):
    results = []
    for node in _find_all(tree.root_node,
                          lambda n: n.type in ("field_declaration", "property_declaration")):
        ln = _line(node)
        if node.type == "field_declaration":
            type_txt = _field_type(node, src)
            for var in _find_all(node, lambda n: n.type == "variable_declarator"):
                vn = var.child_by_field_name("name")
                if vn:
                    results.append((ln, f"[field] {type_txt} {_text(vn, src)}"))
        else:
            type_node = node.child_by_field_name("type")
            type_txt  = _text(type_node, src).strip() if type_node else ""
            name_node = node.child_by_field_name("name")
            if name_node:
                results.append((ln, f"[prop]  {type_txt} {_text(name_node, src)}"))
    return results


def q_calls(src, tree, lines, method_name):
    results = []
    for node in _find_all(tree.root_node,
                          lambda n: n.type == "invocation_expression"):
        if _in_literal(node):
            continue
        fn = node.child_by_field_name("function")
        if not fn:
            continue
        matched = None
        if fn.type == "member_access_expression":
            nn = fn.child_by_field_name("name")
            if nn:
                matched = _strip_generic(_text(nn, src))
        elif fn.type in ("identifier", "generic_name"):
            nn = fn.child_by_field_name("name") if fn.type == "generic_name" else fn
            if nn:
                matched = _strip_generic(_text(nn, src))

        if matched == method_name:
            raw = _text(node, src).replace("\n", " ").replace("\r", "")
            if len(raw) > 140:
                raw = raw[:140] + "…"
            results.append((_line(node), raw))
    return results


def q_implements(src, tree, lines, type_name):
    results = []
    for node in _find_all(tree.root_node, lambda n: n.type in _TYPE_DECL_NODES):
        bases = _base_type_names(node, src)
        if not any(_strip_generic(_unqualify(b)) == type_name for b in bases):
            continue
        name_node = node.child_by_field_name("name")
        if not name_node:
            continue
        kind     = node.type.replace("_declaration", "").replace("_", " ")
        name     = _text(name_node, src)
        base_str = ", ".join(bases)
        results.append((_line(node), f"[{kind}] {name} : {base_str}"))
    return results


def q_uses(src, tree, lines, type_name):
    """
    Find every line where type_name is referenced as a type.
    Skips: comments, string literals, declaration names, and bare method-call identifiers.
    """
    results  = []
    seen_rows = set()

    def _is_decl_name(node):
        """Is this identifier the declared name of a class/method/field/etc.?"""
        p = node.parent
        if not p:
            return False
        nn = p.child_by_field_name("name")
        return nn is not None and nn.start_byte == node.start_byte

    def _is_invocation_target(node):
        """Is this identifier the direct callee in an invocation (not a type)?"""
        p = node.parent
        if not p:
            return False
        # Simple call: foo()
        if p.type == "invocation_expression":
            fn = p.child_by_field_name("function")
            if fn and fn.type == "identifier" and fn.start_byte == node.start_byte:
                return True
        # Member call: x.Foo() — the 'Foo' identifier
        if p.type == "member_access_expression":
            nn = p.child_by_field_name("name")
            if nn and nn.start_byte == node.start_byte:
                return True
        return False

    for node in _find_all(tree.root_node, lambda n: n.type == "identifier"):
        if _text(node, src) != type_name:
            continue
        if _in_literal(node):
            continue
        if _is_decl_name(node):
            continue
        if _is_invocation_target(node):
            continue
        row = node.start_point[0]
        if row in seen_rows:
            continue
        seen_rows.add(row)
        line_text = lines[row].strip() if row < len(lines) else ""
        results.append((_line(node), line_text))
    return results


def q_attrs(src, tree, lines, attr_name=None):
    results = []
    for node in _find_all(tree.root_node, lambda n: n.type == "attribute"):
        name_node = node.child_by_field_name("name")
        if not name_node:
            continue
        aname       = _text(name_node, src).strip()
        aname_short = aname[:-len("Attribute")] if aname.endswith("Attribute") else aname
        aname_unqual = _unqualify(aname_short)
        if attr_name:
            if aname_unqual != attr_name and aname_short != attr_name and aname != attr_name:
                continue
        args_node = node.child_by_field_name("arguments")
        args_txt  = _text(args_node, src).strip() if args_node else ""
        results.append((_line(node), f"[{aname}]{args_txt}"))
    return results


def q_usings(src, tree, lines):
    results = []
    for node in _find_all(tree.root_node, lambda n: n.type == "using_directive"):
        full = _text(node, src).strip().rstrip(";")
        results.append((_line(node), full))
    return results


def q_find(src, tree, lines, name):
    """Print the full source span of every method/type/property named NAME."""
    results = []
    all_targets = _find_all(
        tree.root_node,
        lambda n: n.type in _TYPE_DECL_NODES | _MEMBER_DECL_NODES
    )
    for node in all_targets:
        name_node = node.child_by_field_name("name")
        if not name_node or _text(name_node, src).strip() != name:
            continue
        kind       = node.type.replace("_declaration", "").replace("statement", "").replace("_", " ").strip()
        start_row  = node.start_point[0]
        end_row    = node.end_point[0]
        body_lines = "\n".join(lines[start_row:end_row + 1])
        header     = f"── [{kind}] {name}  (lines {start_row + 1}–{end_row + 1}) ──"
        results.append((_line(node), f"{header}\n{body_lines}"))
    return results


def q_params(src, tree, lines, method_name):
    results = []
    for node in _find_all(tree.root_node,
                          lambda n: n.type in ("method_declaration",
                                               "constructor_declaration",
                                               "local_function_statement")):
        name_node = node.child_by_field_name("name")
        if not name_node or _text(name_node, src).strip() != method_name:
            continue
        params_node = node.child_by_field_name("parameters")
        if not params_node:
            results.append((_line(node), "(no parameters)"))
            continue
        param_lines = []
        for p in _find_all(params_node, lambda n: n.type == "parameter"):
            pt   = p.child_by_field_name("type")
            pn   = p.child_by_field_name("name")
            dfl  = p.child_by_field_name("default")
            pt_t = _text(pt, src).strip() if pt else ""
            pn_t = _text(pn, src).strip() if pn else ""
            df_t = f" = {_text(dfl.children[-1], src).strip()}" if dfl and dfl.children else ""
            # Check for ref/out/in/params modifiers
            mods = [_text(c, src) for c in p.children if c.is_named and c.type in
                    ("parameter_modifier",)]
            mod_t = " ".join(mods) + " " if mods else ""
            param_lines.append(f"  {mod_t}{pt_t} {pn_t}{df_t}".rstrip())
        results.append((_line(node), "\n".join(param_lines) or "(no parameters)"))
    return results


def q_field_type(src, tree, lines, type_name):
    """
    Find fields and properties whose declared type is (or starts with) TYPE.

    Useful for migration analysis: find all 'ConcreteStore _foo' fields that
    should be changed to 'IStorageProvider _foo'.

    TYPE matching is exact on the bare (non-generic) name, so 'IFoo' matches
    both 'IFoo' and 'IFoo<T>'.
    """
    results = []
    for node in _find_all(tree.root_node,
                          lambda n: n.type in ("field_declaration",
                                               "property_declaration")):
        if node.type == "field_declaration":
            type_txt = _field_type(node, src)
            if type_name not in _type_names(type_txt):
                continue
            for var in _find_all(node, lambda n: n.type == "variable_declarator"):
                vn = var.child_by_field_name("name")
                if vn:
                    # Look up enclosing class name for context
                    cls = _enclosing_type_name(node, src)
                    cls_prefix = f"[in {cls}] " if cls else ""
                    results.append((_line(node),
                                    f"[field] {type_txt} {_text(vn, src)}  {cls_prefix}"))
        else:  # property_declaration
            type_node = node.child_by_field_name("type")
            if not type_node:
                continue
            type_txt = _text(type_node, src).strip()
            if type_name not in _type_names(type_txt):
                continue
            name_node = node.child_by_field_name("name")
            if name_node:
                cls = _enclosing_type_name(node, src)
                cls_prefix = f"[in {cls}] " if cls else ""
                results.append((_line(node),
                                 f"[prop]  {type_txt} {_text(name_node, src)}  {cls_prefix}"))
    return results


def q_param_type(src, tree, lines, type_name):
    """
    Find method/constructor parameters whose type is TYPE.

    Useful for migration analysis: find all 'ConcreteStore store' parameters
    in method signatures that should be changed to 'IStorageProvider store'.

    TYPE matching is exact on the bare (non-generic) name.
    """
    results = []
    method_nodes = _find_all(
        tree.root_node,
        lambda n: n.type in ("method_declaration", "constructor_declaration",
                              "local_function_statement", "delegate_declaration",
                              "lambda_expression"),
    )
    for mnode in method_nodes:
        params_node = mnode.child_by_field_name("parameters")
        if not params_node:
            continue
        # Get the method/ctor name for context
        name_node = mnode.child_by_field_name("name")
        mname = _text(name_node, src).strip() if name_node else "<lambda>"
        kind  = mnode.type.replace("_declaration", "").replace("statement", "").replace("_", " ").strip()

        for p in _find_all(params_node, lambda n: n.type == "parameter"):
            pt = p.child_by_field_name("type")
            if not pt:
                continue
            pt_txt = _text(pt, src).strip()
            if type_name not in _type_names(pt_txt):
                continue
            pn = p.child_by_field_name("name")
            pn_txt = _text(pn, src).strip() if pn else ""
            mods = [_text(c, src) for c in p.children
                    if c.is_named and c.type == "parameter_modifier"]
            mod_t = " ".join(mods) + " " if mods else ""
            results.append((_line(p),
                             f"[{kind}] {mname}({mod_t}{pt_txt} {pn_txt})"))
    return results


def q_casts(src, tree, lines, type_name):
    """
    Find every explicit cast expression (TYPE)expr in source code.

    Useful for migration analysis: find all '(ConcreteStore)x' casts that
    should be replaced with 'ConcreteStore.From(x)'.

    TYPE matching is exact on the bare (non-generic) name.
    """
    results = []
    seen_rows = set()
    for node in _find_all(tree.root_node, lambda n: n.type == "cast_expression"):
        if _in_literal(node):
            continue
        type_node = node.child_by_field_name("type")
        if not type_node:
            continue
        cast_type = _strip_generic(_unqualify(_text(type_node, src).strip()))
        if cast_type != type_name:
            continue
        row = node.start_point[0]
        if row in seen_rows:
            continue
        seen_rows.add(row)
        line_text = lines[row].strip() if row < len(lines) else ""
        results.append((_line(node), line_text))
    return results


def q_ident(src, tree, lines, name):
    """
    Find every occurrence of identifier NAME in source code.

    This is a semantic grep: it skips comments and string literals but otherwise
    matches any syntactic context — type declarations, field names, method names,
    call sites, cast targets, local variables, etc.

    Complements the focused modes (uses/calls/field_type/casts) by giving a
    complete picture of every line that references the symbol.
    """
    results = []
    seen_rows = set()
    for node in _find_all(tree.root_node, lambda n: n.type == "identifier"):
        if _text(node, src) != name:
            continue
        if _in_literal(node):
            continue
        row = node.start_point[0]
        if row in seen_rows:
            continue
        seen_rows.add(row)
        line_text = lines[row].strip() if row < len(lines) else ""
        results.append((_line(node), line_text))
    return results


# ── Internal helper ───────────────────────────────────────────────────────────

def _enclosing_type_name(node, src) -> str:
    """Walk up the AST to find the nearest enclosing type declaration's name."""
    p = node.parent
    while p:
        if p.type in _TYPE_DECL_NODES:
            nn = p.child_by_field_name("name")
            if nn:
                return _text(nn, src).strip()
        p = p.parent
    return ""


# ── Typesense file resolver ───────────────────────────────────────────────────

def files_from_search(query, sub=None, ext="cs", limit=50,
                       collection=None, src_root=None):
    """
    Run a Typesense search and return the local file paths of matching documents.
    Faster than globbing when you already know roughly which files are relevant.

    collection: Typesense collection name (defaults to COLLECTION from config).
    src_root:   Source root directory for constructing absolute paths
                (defaults to SRC_ROOT from config).
    """
    from codesearch.config import COLLECTION, SRC_ROOT

    from codesearch.config import to_native_path
    coll_name = collection or COLLECTION
    root = src_root or SRC_ROOT
    src_root_native = to_native_path(root)

    filter_parts = [f"extension:={ext.lstrip('.')}"] if ext else []
    if sub:
        filter_parts.append(f"subsystem:={sub}")

    params = {
        "q":         query,
        "query_by":  "filename,symbols,class_names,method_names,content",
        "per_page":  limit,
        "prefix":    "false",
        "num_typos": "1",
    }
    if filter_parts:
        params["filter_by"] = " && ".join(filter_parts)

    try:
        result = _ts_search(coll_name, params)
    except Exception as e:
        print(f"Typesense search error: {e}", file=sys.stderr)
        print("Is the server running? Try: ts start", file=sys.stderr)
        return []

    paths = []
    seen  = set()
    for hit in result.get("hits", []):
        doc = hit["document"]
        rel = doc.get("relative_path", "")
        if not rel:
            continue
        # Construct native OS path from src_root + relative_path
        path = os.path.join(src_root_native, rel.replace("/", os.sep))
        if path not in seen and os.path.isfile(path):
            seen.add(path)
            paths.append(path)

    found = result.get("found", len(paths))
    print(f"[search] '{query}' → {found} index hits, {len(paths)} local files",
          file=sys.stderr)
    return paths


# ── File processing ───────────────────────────────────────────────────────────

def process_file(path, mode, mode_arg, show_path, count_only, context=0, src_root=None):
    try:
        src_bytes = open(path, "rb").read()
    except OSError as e:
        print(f"ERROR reading {path}: {e}", file=sys.stderr)
        return 0

    try:
        tree = _parser.parse(src_bytes)
    except Exception as e:
        print(f"ERROR parsing {path}: {e}", file=sys.stderr)
        return 0

    lines = src_bytes.decode("utf-8", errors="replace").splitlines()

    dispatch = {
        "classes":    lambda: q_classes(src_bytes, tree, lines),
        "methods":    lambda: q_methods(src_bytes, tree, lines),
        "fields":     lambda: q_fields(src_bytes, tree, lines),
        "calls":      lambda: q_calls(src_bytes, tree, lines, mode_arg),
        "implements": lambda: q_implements(src_bytes, tree, lines, mode_arg),
        "uses":       lambda: q_uses(src_bytes, tree, lines, mode_arg),
        "field_type": lambda: q_field_type(src_bytes, tree, lines, mode_arg),
        "param_type": lambda: q_param_type(src_bytes, tree, lines, mode_arg),
        "casts":      lambda: q_casts(src_bytes, tree, lines, mode_arg),
        "ident":      lambda: q_ident(src_bytes, tree, lines, mode_arg),
        "attrs":      lambda: q_attrs(src_bytes, tree, lines, mode_arg),
        "usings":     lambda: q_usings(src_bytes, tree, lines),
        "find":       lambda: q_find(src_bytes, tree, lines, mode_arg),
        "params":     lambda: q_params(src_bytes, tree, lines, mode_arg),
    }

    fn = dispatch.get(mode)
    if not fn:
        return 0

    results = fn()
    if not results:
        return 0

    # Strip src_root prefix so paths are shown relative to the search root
    from codesearch.config import SRC_ROOT as _SRC_ROOT
    _effective_root = (src_root or _SRC_ROOT).rstrip("/").replace("\\", "/")
    _path_norm = path.replace("\\", "/")
    if _effective_root and _path_norm.lower().startswith(_effective_root.lower() + "/"):
        _disp_base = _path_norm[len(_effective_root) + 1:]
    else:
        _disp_base = _path_norm

    if count_only:
        print(f"{len(results):4d}  {_disp_base}")
        return len(results)

    disp_path = _disp_base
    for line_num_str, text in results:
        if show_path:
            print(f"{disp_path}:{line_num_str}: {text}")
        else:
            print(f"{line_num_str}: {text}")

        # Optional surrounding context lines (like grep -C)
        if context > 0 and mode not in ("find",):
            try:
                row = int(line_num_str) - 1  # convert back to 0-based
                start = max(0, row - context)
                end   = min(len(lines), row + context + 1)
                for i, ln in enumerate(lines[start:end], start):
                    if i == row:
                        continue  # already printed as the match line
                    prefix = f"  {disp_path}:{i + 1}-" if show_path else f"  {i + 1}-"
                    print(f"{prefix} {ln}")
                print()
            except (ValueError, IndexError):
                pass
    return len(results)


# ── Glob expansion ────────────────────────────────────────────────────────────

def expand_files(patterns):
    files = []
    seen  = set()
    for pat in patterns:
        pat = pat.replace("\\", "/")
        if any(c in pat for c in ("*", "?")):
            for f in sorted(_glob.glob(pat, recursive=True)):
                f = f.replace("\\", "/")
                if f.endswith(".cs") and f not in seen:
                    seen.add(f)
                    files.append(f)
        elif os.path.isdir(pat):
            for root, _, fnames in os.walk(pat):
                for fn in sorted(fnames):
                    if fn.endswith(".cs"):
                        fp = os.path.join(root, fn).replace("\\", "/")
                        if fp not in seen:
                            seen.add(fp)
                            files.append(fp)
        elif os.path.isfile(pat) and pat not in seen:
            seen.add(pat)
            files.append(pat)
    return files


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    mg = ap.add_mutually_exclusive_group(required=True)
    mg.add_argument("--classes",    action="store_true",
                    help="List all type declarations")
    mg.add_argument("--methods",    action="store_true",
                    help="List all method/field/property signatures")
    mg.add_argument("--fields",     action="store_true",
                    help="List all field and property declarations")
    mg.add_argument("--calls",      metavar="METHOD",
                    help="Find every call site of METHOD")
    mg.add_argument("--implements", metavar="TYPE",
                    help="Find types inheriting/implementing TYPE")
    mg.add_argument("--uses",       metavar="TYPE",
                    help="Find all type references to TYPE (not comments/strings)")
    mg.add_argument("--field-type", metavar="TYPE",
                    help="Find fields/properties whose declared type is TYPE")
    mg.add_argument("--param-type", metavar="TYPE",
                    help="Find method/constructor parameters typed as TYPE")
    mg.add_argument("--casts",      metavar="TYPE",
                    help="Find every explicit cast expression (TYPE)expr")
    mg.add_argument("--ident",      metavar="NAME",
                    help="Find every identifier occurrence (semantic grep, skips comments/strings)")
    mg.add_argument("--attrs",      metavar="NAME", nargs="?", const="",
                    help="List [Attribute] decorators (optionally filter by NAME)")
    mg.add_argument("--usings",     action="store_true",
                    help="List all using directives")
    mg.add_argument("--find",       metavar="NAME",
                    help="Print full source of method/type named NAME")
    mg.add_argument("--params",     metavar="METHOD",
                    help="Show parameter list of METHOD")

    ap.add_argument("files", nargs="*", metavar="FILE_OR_PATTERN",
                    help="Files, directories, or glob patterns (** for recursive). "
                         "Omit when using --search.")
    ap.add_argument("--search",       metavar="QUERY",
                    help="Use Typesense to find files matching QUERY instead of globs. "
                         "Much faster than globbing for targeted searches.")
    ap.add_argument("--search-sub",   metavar="SUBSYSTEM",
                    help="Filter Typesense search by subsystem (e.g. myapp, services)")
    ap.add_argument("--search-ext",   metavar="EXT", default="cs",
                    help="Filter Typesense search by extension (default: cs)")
    ap.add_argument("--search-limit", metavar="N", type=int, default=50,
                    help="Max files to fetch from Typesense (default: 50)")
    ap.add_argument("--no-path", action="store_true",
                    help="Omit file path prefix (auto-set for single files)")
    ap.add_argument("--count",   action="store_true",
                    help="Print only match counts per file + total")
    ap.add_argument("--context", metavar="N", type=int, default=0,
                    help="Show N surrounding source lines around each match (like grep -C)")
    args = ap.parse_args()

    if not args.files and not args.search:
        ap.error("Provide FILE_OR_PATTERN arguments or use --search QUERY")

    # Resolve mode + arg
    if args.classes:
        mode, mode_arg = "classes",    None
    elif args.methods:
        mode, mode_arg = "methods",    None
    elif args.fields:
        mode, mode_arg = "fields",     None
    elif args.calls:
        mode, mode_arg = "calls",      args.calls
    elif args.implements:
        mode, mode_arg = "implements", args.implements
    elif args.uses:
        mode, mode_arg = "uses",       args.uses
    elif args.field_type:
        mode, mode_arg = "field_type", args.field_type
    elif args.param_type:
        mode, mode_arg = "param_type", args.param_type
    elif args.casts:
        mode, mode_arg = "casts",      args.casts
    elif args.ident:
        mode, mode_arg = "ident",      args.ident
    elif args.attrs is not None:
        mode, mode_arg = "attrs",      args.attrs or None
    elif args.usings:
        mode, mode_arg = "usings",     None
    elif args.find:
        mode, mode_arg = "find",       args.find
    elif args.params:
        mode, mode_arg = "params",     args.params
    else:
        ap.print_help(); sys.exit(1)

    if args.search:
        files = files_from_search(
            query=args.search,
            sub=getattr(args, "search_sub", None),
            ext=getattr(args, "search_ext", "cs"),
            limit=getattr(args, "search_limit", 50),
        )
        if not files:
            print("No matching files found in index.", file=sys.stderr)
            sys.exit(1)
    else:
        files = expand_files(args.files)
        if not files:
            print(f"No .cs files found: {' '.join(args.files)}", file=sys.stderr)
            sys.exit(1)

    has_glob  = any(c in p for p in (args.files or []) for c in ("*", "?"))
    show_path = not args.no_path and (len(files) > 1 or has_glob or bool(args.search))

    total = 0
    for f in files:
        total += process_file(f, mode, mode_arg, show_path, args.count, context=args.context)

    if args.count:
        print(f"\nTotal: {total}")
    elif len(files) > 1:
        print(f"\n({total} matches across {len(files)} files)", file=sys.stderr)


if __name__ == "__main__":
    main()
