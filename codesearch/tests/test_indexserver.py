"""
Tests for codesearch.indexserver — the WSL-side indexer package.

Skips automatically if Typesense is not running.
Creates isolated temp git repos + collections; tears down after each class.

Run (from WSL):
    cd /mnt/c/myproject/claudeskills
    ~/.local/indexserver-venv/bin/pytest codesearch/tests/test_indexserver.py -v

Run a single test:
    ~/.local/indexserver-venv/bin/pytest codesearch/tests/test_indexserver.py::TestIndexer::test_collection_created -v
"""

import io
import os
import sys
import time
import json
import shutil
import tempfile
import subprocess
import unittest
import urllib.request
import urllib.parse

# ── path setup ────────────────────────────────────────────────────────────────
_claudeskills = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _claudeskills not in sys.path:
    sys.path.insert(0, _claudeskills)

from codesearch.indexserver.config import HOST, PORT, API_KEY
from codesearch.indexserver.indexer import run_index, extract_cs_metadata, extract_py_metadata
from codesearch.query import process_file as _query_process_file
from codesearch.query import process_py_file as _query_process_py_file


# ── helpers ───────────────────────────────────────────────────────────────────

def _server_ok() -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{PORT}/health", timeout=3) as r:
            return json.loads(r.read()).get("ok", False)
    except Exception:
        return False


def _search(collection: str, q: str,
            query_by: str = "filename,symbols,class_names,method_names,content",
            per_page: int = 10) -> list[dict]:
    params = urllib.parse.urlencode({
        "q": q, "query_by": query_by,
        "per_page": per_page, "num_typos": 0,
    })
    url = f"http://{HOST}:{PORT}/collections/{collection}/documents/search?{params}"
    req = urllib.request.Request(url, headers={"X-TYPESENSE-API-KEY": API_KEY})
    with urllib.request.urlopen(req, timeout=5) as r:
        return [h["document"] for h in json.loads(r.read()).get("hits", [])]


def _collection_info(collection: str) -> dict | None:
    url = f"http://{HOST}:{PORT}/collections/{collection}"
    req = urllib.request.Request(url, headers={"X-TYPESENSE-API-KEY": API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            return json.loads(r.read())
    except Exception:
        return None


def _delete_collection(collection: str) -> None:
    url = f"http://{HOST}:{PORT}/collections/{collection}"
    req = urllib.request.Request(url, method="DELETE",
                                  headers={"X-TYPESENSE-API-KEY": API_KEY})
    try:
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass


def _make_git_repo(files: dict) -> str:
    """Create a temp dir with files and init a git repo. Returns tmpdir path."""
    tmpdir = tempfile.mkdtemp(prefix="ts_idx_test_")
    for rel, content in files.items():
        full = os.path.join(tmpdir, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
    subprocess.run(["git", "-C", tmpdir, "init", "-q"], check=True)
    subprocess.run(["git", "-C", tmpdir, "add", "."], check=True)
    return tmpdir


# ── sample C# source ─────────────────────────────────────────────────────────

_FOO_CS = """\
using System;
namespace TestNs {
    [Serializable]
    public class Foo : IDisposable, IComparable {
        public string Name { get; set; }
        public void Dispose() { }
        public int CompareTo(object obj) { return 0; }
        public void DoWork(string input) { }
    }
}
"""

_BAR_CS = """\
namespace TestNs {
    public class Bar : Foo {
        private Foo _foo;
        public Bar(Foo foo) { _foo = foo; }
        public void Process() { _foo.DoWork("hello"); }
    }
}
"""

_BLOBSTORE_CS = """\
using System.Threading.Tasks;
namespace Storage {
    public interface IBlobStore {
        Task WriteAsync(string key, byte[] data);
        Task<byte[]> ReadAsync(string key);
    }
    public class BlobStore : IBlobStore {
        public async Task WriteAsync(string key, byte[] data) { }
        public async Task<byte[]> ReadAsync(string key) { return new byte[0]; }
    }
}
"""

# Source that uses explicitly-qualified (namespaced) type names — no using directives.
_QUALIFIED_CS = """\
namespace MyApp {
    [My.Auth.AuthorizeAttribute]
    public class Widget : Acme.IBlobStore, Generic.IComparable<Widget> {
        private Acme.IBlobStore _store;
        public Acme.IBlobStore Store { get; set; }
        public string Process(Acme.IBlobStore store) { return ""; }
    }
}
"""

# Source that wraps types in common generic containers.
_GENERIC_WRAPPER_CS = """\
using System.Collections.Generic;
using System.Threading.Tasks;
namespace MyApp {
    public class WidgetService {
        private IList<IBlobStore> _stores;
        public IReadOnlyList<IBlobStore> Stores { get; set; }
        public Task<IBlobStore> GetAsync(string key) { return null; }
        public void Register(IList<IBlobStore> stores) { }
    }
}
"""


# ── test: indexer basics ──────────────────────────────────────────────────────

@unittest.skipUnless(_server_ok(), "Typesense not running — start with: ts start")
class TestIndexer(unittest.TestCase):
    """Indexer creates a collection and indexes C# + other files."""

    @classmethod
    def setUpClass(cls):
        stamp = int(time.time())
        cls.coll = f"test_idx_{stamp}"
        cls.tmpdir = _make_git_repo({
            "myapp/Foo.cs":          _FOO_CS,
            "myapp/Bar.cs":          _BAR_CS,
            "storage/BlobStore.cs":  _BLOBSTORE_CS,
            "scripts/deploy.py":     "# deployment script\ndef run(): pass\n",
            "README.md":             "# My project\n",
        })
        run_index(src_root=cls.tmpdir, collection=cls.coll, reset=True, verbose=False)
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        _delete_collection(cls.coll)
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def test_collection_created(self):
        info = _collection_info(self.coll)
        self.assertIsNotNone(info, f"Collection {self.coll!r} not found")

    def test_all_files_indexed(self):
        info = _collection_info(self.coll)
        self.assertGreaterEqual(info["num_documents"], 5,
            f"Expected >=5 docs, got {info['num_documents']}")

    def test_cs_file_findable(self):
        hits = _search(self.coll, "Foo")
        names = [h["filename"] for h in hits]
        self.assertIn("Foo.cs", names, f"Foo.cs not in {names}")

    def test_python_file_indexed(self):
        hits = _search(self.coll, "deploy", query_by="filename,content")
        names = [h["filename"] for h in hits]
        self.assertIn("deploy.py", names, f"deploy.py not in {names}")

    def test_markdown_indexed(self):
        hits = _search(self.coll, "project", query_by="filename,content")
        names = [h["filename"] for h in hits]
        self.assertIn("README.md", names, f"README.md not in {names}")

    def test_relative_path_not_absolute(self):
        hits = _search(self.coll, "Foo")
        tmpdir_norm = self.tmpdir.replace("\\", "/").lower()
        for h in hits:
            self.assertNotIn(tmpdir_norm, h["relative_path"].lower(),
                f"relative_path contains tmpdir: {h['relative_path']}")

    def test_relative_path_structure(self):
        hits = _search(self.coll, "Foo")
        foo = next((h for h in hits if h["filename"] == "Foo.cs"), None)
        self.assertIsNotNone(foo, "Foo.cs not found")
        self.assertEqual(foo["relative_path"], "myapp/Foo.cs",
            f"Expected myapp/Foo.cs, got {foo['relative_path']}")

    def test_subsystem_extracted(self):
        hits = _search(self.coll, "BlobStore")
        blob = next((h for h in hits if h["filename"] == "BlobStore.cs"), None)
        self.assertIsNotNone(blob, "BlobStore.cs not found")
        self.assertEqual(blob["subsystem"], "storage")

    def test_cs_priority_3(self):
        hits = _search(self.coll, "Foo")
        foo = next((h for h in hits if h["filename"] == "Foo.cs"), None)
        self.assertIsNotNone(foo)
        self.assertEqual(foo["priority"], 3)

    def test_py_priority_1(self):
        hits = _search(self.coll, "deploy", query_by="filename,content")
        py = next((h for h in hits if h["filename"] == "deploy.py"), None)
        self.assertIsNotNone(py, "deploy.py not found")
        self.assertEqual(py["priority"], 1)

    def test_reset_recreates_collection(self):
        """reset=True drops and recreates the collection."""
        old_info = _collection_info(self.coll)
        # Sleep >1 s so the new collection's created_at (epoch seconds) differs
        time.sleep(1.1)
        run_index(src_root=self.tmpdir, collection=self.coll, reset=True, verbose=False)
        time.sleep(0.3)
        new_info = _collection_info(self.coll)
        self.assertIsNotNone(new_info)
        self.assertNotEqual(old_info.get("created_at"), new_info.get("created_at"),
            "Collection was not recreated (same created_at)")


# ── test: semantic C# fields ──────────────────────────────────────────────────

@unittest.skipUnless(_server_ok(), "Typesense not running — start with: ts start")
class TestSemanticFields(unittest.TestCase):
    """tree-sitter extracts the right symbols and semantic metadata."""

    @classmethod
    def setUpClass(cls):
        stamp = int(time.time())
        cls.coll = f"test_sem_{stamp}"
        cls.tmpdir = _make_git_repo({
            "core/Foo.cs": _FOO_CS,
            "core/Bar.cs": _BAR_CS,
        })
        run_index(src_root=cls.tmpdir, collection=cls.coll, reset=True, verbose=False)
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        _delete_collection(cls.coll)
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _get(self, filename):
        base = os.path.splitext(filename)[0]
        hits = _search(self.coll, base, per_page=5)
        return next((h for h in hits if h["filename"] == filename), None)

    def test_base_types_interface(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        self.assertIn("IDisposable", foo.get("base_types", []),
            f"base_types: {foo.get('base_types')}")

    def test_base_types_multiple(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        self.assertIn("IComparable", foo.get("base_types", []),
            f"base_types: {foo.get('base_types')}")

    def test_base_class_in_base_types(self):
        bar = self._get("Bar.cs")
        self.assertIsNotNone(bar)
        self.assertIn("Foo", bar.get("base_types", []),
            f"base_types for Bar: {bar.get('base_types')}")

    def test_call_sites(self):
        bar = self._get("Bar.cs")
        self.assertIsNotNone(bar)
        self.assertIn("DoWork", bar.get("call_sites", []),
            f"call_sites: {bar.get('call_sites')}")

    def test_type_refs(self):
        bar = self._get("Bar.cs")
        self.assertIsNotNone(bar)
        self.assertIn("Foo", bar.get("type_refs", []),
            f"type_refs: {bar.get('type_refs')}")

    def test_attributes(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        self.assertIn("Serializable", foo.get("attributes", []),
            f"attributes: {foo.get('attributes')}")

    def test_usings(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        self.assertIn("System", foo.get("usings", []),
            f"usings: {foo.get('usings')}")

    def test_class_names(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        self.assertIn("Foo", foo.get("class_names", []))

    def test_method_names(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        methods = foo.get("method_names", [])
        self.assertIn("Dispose", methods, f"method_names: {methods}")
        self.assertIn("DoWork",  methods, f"method_names: {methods}")

    def test_method_sigs(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        sigs = foo.get("method_sigs", [])
        self.assertTrue(any("Dispose" in s for s in sigs),
                        f"expected 'Dispose' in method_sigs: {sigs}")
        self.assertTrue(any("DoWork" in s for s in sigs),
                        f"expected 'DoWork' in method_sigs: {sigs}")

    def test_namespace(self):
        foo = self._get("Foo.cs")
        self.assertIsNotNone(foo)
        self.assertEqual(foo.get("namespace"), "TestNs",
                         f"namespace: {foo.get('namespace')}")


# ── test: multi-root isolation ────────────────────────────────────────────────

@unittest.skipUnless(_server_ok(), "Typesense not running — start with: ts start")
class TestMultiRoot(unittest.TestCase):
    """Two independent collections for the same source tree stay isolated."""

    @classmethod
    def setUpClass(cls):
        stamp = int(time.time())
        cls.coll_a = f"test_root_a_{stamp}"
        cls.coll_b = f"test_root_b_{stamp}"
        cls.tmpdir = _make_git_repo({
            "Foo.cs": _FOO_CS,
            "Bar.cs": _BAR_CS,
        })
        run_index(src_root=cls.tmpdir, collection=cls.coll_a, reset=True, verbose=False)
        run_index(src_root=cls.tmpdir, collection=cls.coll_b, reset=True, verbose=False)
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        _delete_collection(cls.coll_a)
        _delete_collection(cls.coll_b)
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def test_both_collections_exist(self):
        self.assertIsNotNone(_collection_info(self.coll_a))
        self.assertIsNotNone(_collection_info(self.coll_b))

    def test_coll_a_searchable(self):
        hits = _search(self.coll_a, "Foo")
        self.assertGreater(len(hits), 0)

    def test_coll_b_searchable(self):
        hits = _search(self.coll_b, "Foo")
        self.assertGreater(len(hits), 0)

    def test_same_doc_count(self):
        """Both collections indexed the same files."""
        a = _collection_info(self.coll_a)["num_documents"]
        b = _collection_info(self.coll_b)["num_documents"]
        self.assertEqual(a, b, f"coll_a={a} docs vs coll_b={b} docs")

    def test_nonexistent_collection_returns_none(self):
        self.assertIsNone(_collection_info("codesearch_does_not_exist_xyz"))


# ── test: extract_cs_metadata (unit tests, no server needed) ─────────────────

class TestExtractCsMetadata(unittest.TestCase):
    """Unit tests for the tree-sitter C# extractor — no server required."""

    def test_class_names(self):
        src = b"namespace N { public class MyClass { } }"
        meta = extract_cs_metadata(src)
        self.assertIn("MyClass", meta["class_names"])

    def test_interface_in_base_types(self):
        src = b"public class Impl : IService { }"
        meta = extract_cs_metadata(src)
        self.assertIn("IService", meta["base_types"])

    def test_call_sites(self):
        src = b"class C { void M() { Foo.Bar(); Baz(); } }"
        meta = extract_cs_metadata(src)
        self.assertTrue(
            "Bar" in meta["call_sites"] or "Baz" in meta["call_sites"],
            f"call_sites: {meta['call_sites']}"
        )

    def test_usings(self):
        src = b"using System; using System.Collections.Generic;"
        meta = extract_cs_metadata(src)
        self.assertIn("System", meta["usings"])

    def test_malformed_source_no_crash(self):
        src = b"{{ totally invalid C# !! @@@"
        meta = extract_cs_metadata(src)
        self.assertIsInstance(meta, dict)

    # ── qualified-name stripping ───────────────────────────────────────────────

    def test_qualified_base_type_stripped(self):
        """Qualified base type 'Acme.IBlobStore' → stored as 'IBlobStore'."""
        meta = extract_cs_metadata(_QUALIFIED_CS.encode())
        self.assertIn("IBlobStore", meta["base_types"],
                      f"base_types: {meta['base_types']}")
        self.assertNotIn("Acme.IBlobStore", meta["base_types"],
                         "full qualified name should not be stored in base_types")

    def test_qualified_type_ref_field_stripped(self):
        """Qualified field type 'Acme.IBlobStore' → stored as 'IBlobStore' in type_refs."""
        meta = extract_cs_metadata(_QUALIFIED_CS.encode())
        self.assertIn("IBlobStore", meta["type_refs"],
                      f"type_refs: {meta['type_refs']}")
        self.assertNotIn("Acme.IBlobStore", meta["type_refs"],
                         "full qualified name should not appear in type_refs")

    def test_qualified_attribute_stripped(self):
        """Qualified attribute '[My.Auth.AuthorizeAttribute]' → stored as 'Authorize'."""
        meta = extract_cs_metadata(_QUALIFIED_CS.encode())
        self.assertIn("Authorize", meta["attributes"],
                      f"attributes: {meta['attributes']}")
        self.assertNotIn("My.Auth.Authorize", meta["attributes"],
                         "namespace-prefixed attribute should not appear in attributes")

    # ── generic type argument expansion ───────────────────────────────────────

    def test_type_ref_generic_stores_full_and_arg(self):
        """'IList<IBlobStore>' stores both 'IList<IBlobStore>' and 'IBlobStore' in type_refs."""
        meta = extract_cs_metadata(_GENERIC_WRAPPER_CS.encode())
        refs = meta["type_refs"]
        self.assertIn("IBlobStore", refs,
                      f"IBlobStore (type arg) should appear in type_refs: {refs}")
        self.assertTrue(any("IList" in r for r in refs),
                        f"IList should appear in type_refs: {refs}")

    def test_type_ref_task_generic_stores_arg(self):
        """'Task<IBlobStore>' stores 'IBlobStore' in type_refs."""
        meta = extract_cs_metadata(_GENERIC_WRAPPER_CS.encode())
        self.assertIn("IBlobStore", meta["type_refs"],
                      f"IBlobStore (Task<IBlobStore> return type arg) should be in type_refs: {meta['type_refs']}")


# ── test: search field modes ─────────────────────────────────────────────────

@unittest.skipUnless(_server_ok(), "Typesense not running — start with: ts start")
class TestSearchFieldModes(unittest.TestCase):
    """Verify each MCP search mode's query_by field string returns the right file.

    This tests that the indexed semantic fields (base_types, call_sites, method_sigs,
    type_refs, attributes) are actually usable as Typesense query_by targets — i.e.
    that the search modes the MCP server advertises can actually find documents.
    """

    @classmethod
    def setUpClass(cls):
        stamp = int(time.time())
        cls.coll = f"test_modes_{stamp}"
        cls.tmpdir = _make_git_repo({
            "core/Foo.cs": _FOO_CS,
            "core/Bar.cs": _BAR_CS,
        })
        run_index(src_root=cls.tmpdir, collection=cls.coll, reset=True, verbose=False)
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        _delete_collection(cls.coll)
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _qby(self, q, query_by, per_page=10):
        return _search(self.coll, q, query_by=query_by, per_page=per_page)

    def test_implements_mode_base_types(self):
        """'implements' mode: query_by=base_types finds Foo.cs via IDisposable."""
        hits = self._qby("IDisposable", "base_types,class_names,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("Foo.cs", names,
                      f"base_types query for 'IDisposable' → {names}")

    def test_callers_mode_call_sites(self):
        """'callers' mode: query_by=call_sites finds Bar.cs via DoWork."""
        hits = self._qby("DoWork", "call_sites,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("Bar.cs", names,
                      f"call_sites query for 'DoWork' → {names}")

    def test_sig_mode_method_sigs(self):
        """'sig' mode: query_by=method_sigs finds Foo.cs via Dispose."""
        hits = self._qby("Dispose", "method_sigs,method_names,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("Foo.cs", names,
                      f"method_sigs query for 'Dispose' → {names}")

    def test_uses_mode_type_refs(self):
        """'uses' mode: query_by=type_refs finds Bar.cs which holds a Foo field."""
        hits = self._qby("Foo", "type_refs,symbols,class_names,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("Bar.cs", names,
                      f"type_refs query for 'Foo' → {names}")

    def test_attr_mode_attributes(self):
        """'attr' mode: query_by=attributes finds Foo.cs via [Serializable]."""
        hits = self._qby("Serializable", "attributes,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("Foo.cs", names,
                      f"attributes query for 'Serializable' → {names}")

    def test_namespace_in_query(self):
        """Namespace field is populated and searchable via content."""
        hits = self._qby("TestNs", "content,filename")
        names = [h["filename"] for h in hits]
        self.assertTrue(len(names) > 0,
                        "Expected at least one file with namespace 'TestNs'")


# ── test: process_file / query_cs modes ──────────────────────────────────────

class TestQueryCs(unittest.TestCase):
    """Unit tests for process_file() from codesearch.query — no server needed.

    Verifies:
    1. Each query mode extracts the expected output from sample C# files.
    2. The AST fields query.py extracts are consistent with what indexer.py indexes.
    """

    @classmethod
    def setUpClass(cls):
        cls.tmpdir = tempfile.mkdtemp(prefix="ts_qcs_test_")
        cls.foo_path = os.path.join(cls.tmpdir, "Foo.cs")
        cls.bar_path = os.path.join(cls.tmpdir, "Bar.cs")
        with open(cls.foo_path, "w", encoding="utf-8") as f:
            f.write(_FOO_CS)
        with open(cls.bar_path, "w", encoding="utf-8") as f:
            f.write(_BAR_CS)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _run(self, path, mode, mode_arg=None):
        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        try:
            n = _query_process_file(
                path=path, mode=mode, mode_arg=mode_arg,
                show_path=True, count_only=False, context=0,
                src_root=self.tmpdir,
            )
        finally:
            sys.stdout = old
        return n or 0, buf.getvalue()

    # ── mode: classes ──────────────────────────────────────────────────────────

    def test_classes_lists_foo(self):
        n, out = self._run(self.foo_path, "classes")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    def test_classes_shows_base_types(self):
        n, out = self._run(self.foo_path, "classes")
        self.assertIn("IDisposable", out)

    # ── mode: methods ──────────────────────────────────────────────────────────

    def test_methods_lists_dispose(self):
        n, out = self._run(self.foo_path, "methods")
        self.assertGreater(n, 0)
        self.assertIn("Dispose", out)

    def test_methods_lists_dowork(self):
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("DoWork", out)

    def test_methods_lists_field(self):
        """method mode also lists fields."""
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("Name", out)

    # ── mode: fields ──────────────────────────────────────────────────────────

    def test_fields_lists_foo_field_in_bar(self):
        n, out = self._run(self.bar_path, "fields")
        self.assertGreater(n, 0)
        self.assertIn("_foo", out)

    # ── mode: calls ───────────────────────────────────────────────────────────

    def test_calls_dowork_found_in_bar(self):
        n, out = self._run(self.bar_path, "calls", "DoWork")
        self.assertGreater(n, 0)
        self.assertIn("DoWork", out)

    def test_calls_absent_method_no_match(self):
        n, out = self._run(self.foo_path, "calls", "NonExistentMethod999")
        self.assertEqual(n, 0)

    # ── mode: implements ──────────────────────────────────────────────────────

    def test_implements_idisposable_finds_foo(self):
        n, out = self._run(self.foo_path, "implements", "IDisposable")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    def test_implements_nonexistent_no_match(self):
        n, out = self._run(self.foo_path, "implements", "INonExistent999")
        self.assertEqual(n, 0)

    # ── mode: uses ────────────────────────────────────────────────────────────

    def test_uses_foo_in_bar(self):
        n, out = self._run(self.bar_path, "uses", "Foo")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    # ── mode: field_type ──────────────────────────────────────────────────────

    def test_field_type_foo_in_bar(self):
        n, out = self._run(self.bar_path, "field_type", "Foo")
        self.assertGreater(n, 0)
        self.assertIn("_foo", out)

    # ── mode: param_type ──────────────────────────────────────────────────────

    def test_param_type_foo_in_bar_ctor(self):
        n, out = self._run(self.bar_path, "param_type", "Foo")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    # ── mode: attrs ───────────────────────────────────────────────────────────

    def test_attrs_serializable_in_foo(self):
        n, out = self._run(self.foo_path, "attrs", "Serializable")
        self.assertGreater(n, 0)
        self.assertIn("Serializable", out)

    # ── mode: usings ──────────────────────────────────────────────────────────

    def test_usings_system_in_foo(self):
        n, out = self._run(self.foo_path, "usings")
        self.assertGreater(n, 0)
        self.assertIn("System", out)

    # ── relative path stripping ───────────────────────────────────────────────

    def test_display_path_is_relative(self):
        """process_file should display path relative to src_root, not absolute."""
        n, out = self._run(self.foo_path, "classes")
        self.assertGreater(n, 0)
        self.assertIn("Foo.cs", out)
        tmpdir_norm = self.tmpdir.replace("\\", "/")
        self.assertNotIn(tmpdir_norm, out,
                         f"full tmpdir path leaked into output:\n{out}")

    # ── consistency: query.py ↔ indexer.py ───────────────────────────────────

    def test_class_names_consistent(self):
        """class_names from indexer match what query.py classes mode finds."""
        meta = extract_cs_metadata(_FOO_CS.encode())
        self.assertIn("Foo", meta["class_names"])
        n, out = self._run(self.foo_path, "classes")
        self.assertIn("Foo", out)

    def test_method_sigs_consistent(self):
        """method_sigs from indexer match what query.py methods mode finds."""
        meta = extract_cs_metadata(_FOO_CS.encode())
        sigs = meta["method_sigs"]
        self.assertTrue(any("Dispose" in s for s in sigs), f"method_sigs: {sigs}")
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("Dispose", out)
        self.assertIn("DoWork", out)

    def test_base_types_consistent(self):
        """base_types from indexer match what query.py implements mode uses."""
        meta = extract_cs_metadata(_FOO_CS.encode())
        self.assertIn("IDisposable", meta["base_types"])
        n, out = self._run(self.foo_path, "implements", "IDisposable")
        self.assertGreater(n, 0)

    def test_call_sites_consistent(self):
        """call_sites from indexer match query.py calls mode."""
        meta = extract_cs_metadata(_BAR_CS.encode())
        self.assertIn("DoWork", meta["call_sites"])
        n, out = self._run(self.bar_path, "calls", "DoWork")
        self.assertGreater(n, 0)

    def test_type_refs_consistent(self):
        """type_refs from indexer match query.py field_type mode."""
        meta = extract_cs_metadata(_BAR_CS.encode())
        self.assertIn("Foo", meta["type_refs"])
        n, out = self._run(self.bar_path, "field_type", "Foo")
        self.assertGreater(n, 0)

    def test_attributes_consistent(self):
        """attributes from indexer match query.py attrs mode."""
        meta = extract_cs_metadata(_FOO_CS.encode())
        self.assertIn("Serializable", meta["attributes"])
        n, out = self._run(self.foo_path, "attrs", "Serializable")
        self.assertGreater(n, 0)

    def test_usings_consistent(self):
        """usings from indexer match query.py usings mode."""
        meta = extract_cs_metadata(_FOO_CS.encode())
        self.assertIn("System", meta["usings"])
        n, out = self._run(self.foo_path, "usings")
        self.assertIn("System", out)

    # ── qualified-name stripping (query.py) ───────────────────────────────────

    @classmethod
    def _make_qualified_file(cls):
        path = os.path.join(cls.tmpdir, "Qualified.cs")
        with open(path, "w", encoding="utf-8") as f:
            f.write(_QUALIFIED_CS)
        return path

    def test_implements_qualified_name_matches_simple(self):
        """query.py implements mode: 'IBlobStore' matches 'Acme.IBlobStore'."""
        path = self._make_qualified_file()
        n, out = self._run(path, "implements", "IBlobStore")
        self.assertGreater(n, 0,
            "implements 'IBlobStore' should find Widget which inherits Acme.IBlobStore")

    def test_field_type_qualified_matches_simple(self):
        """query.py field_type mode: 'IBlobStore' matches field typed 'Acme.IBlobStore'."""
        path = self._make_qualified_file()
        n, out = self._run(path, "field_type", "IBlobStore")
        self.assertGreater(n, 0,
            "field_type 'IBlobStore' should find '_store' field of type Acme.IBlobStore")

    def test_param_type_qualified_matches_simple(self):
        """query.py param_type mode: 'IBlobStore' matches param typed 'Acme.IBlobStore'."""
        path = self._make_qualified_file()
        n, out = self._run(path, "param_type", "IBlobStore")
        self.assertGreater(n, 0,
            "param_type 'IBlobStore' should find Process(Acme.IBlobStore store)")

    def test_attrs_qualified_matches_simple(self):
        """query.py attrs mode: 'Authorize' matches '[My.Auth.AuthorizeAttribute]'."""
        path = self._make_qualified_file()
        n, out = self._run(path, "attrs", "Authorize")
        self.assertGreater(n, 0,
            "attrs 'Authorize' should find [My.Auth.AuthorizeAttribute]")

    # ── generic wrapper matching (query.py) ───────────────────────────────────

    @classmethod
    def _make_generic_wrapper_file(cls):
        path = os.path.join(cls.tmpdir, "GenericWrapper.cs")
        with open(path, "w", encoding="utf-8") as f:
            f.write(_GENERIC_WRAPPER_CS)
        return path

    def test_field_type_matches_generic_wrapper_arg(self):
        """field_type 'IBlobStore' matches field of type 'IList<IBlobStore>'."""
        path = self._make_generic_wrapper_file()
        n, out = self._run(path, "field_type", "IBlobStore")
        self.assertGreater(n, 0,
            "field_type 'IBlobStore' should find IList<IBlobStore> field '_stores'")

    def test_param_type_matches_generic_wrapper_arg(self):
        """param_type 'IBlobStore' matches parameter of type 'IList<IBlobStore>'."""
        path = self._make_generic_wrapper_file()
        n, out = self._run(path, "param_type", "IBlobStore")
        self.assertGreater(n, 0,
            "param_type 'IBlobStore' should find Register(IList<IBlobStore> stores)")

    def test_field_type_outer_still_matches(self):
        """field_type 'IList' still matches a field of type 'IList<IBlobStore>'."""
        path = self._make_generic_wrapper_file()
        n, out = self._run(path, "field_type", "IList")
        self.assertGreater(n, 0,
            "field_type 'IList' should still find IList<IBlobStore> fields")


# ── helpers: mock Typesense client ───────────────────────────────────────────

class _MockDocuments:
    def __init__(self):
        self.upserted: list[dict] = []
        self.deleted: list[str] = []

    def import_(self, docs, params):
        self.upserted.extend(docs)
        return [{"success": True}] * len(docs)

    def __getitem__(self, doc_id: str):
        parent = self
        class _Doc:
            def delete(self_):
                parent.deleted.append(doc_id)
        return _Doc()


class _MockCollection:
    def __init__(self):
        self.documents = _MockDocuments()


class _MockTypesenseClient:
    def __init__(self, collection_name: str = "test_coll"):
        self._colls: dict[str, _MockCollection] = {collection_name: _MockCollection()}

    @property
    def collections(self):
        return self._colls


# ── mock watchdog events ──────────────────────────────────────────────────────

class _FakeEvent:
    def __init__(self, src_path: str, is_directory: bool = False, dest_path: str = ""):
        self.src_path = src_path
        self.is_directory = is_directory
        self.dest_path = dest_path


# ── test: CsChangeHandler unit tests (no Typesense) ──────────────────────────

class TestCsChangeHandlerUnit(unittest.TestCase):
    """Unit tests for CsChangeHandler event routing and flush logic.

    Uses a mock Typesense client — no running server required.
    All paths are real temp-dir paths so os.path calls work correctly.
    """

    COLL = "test_coll"

    def setUp(self):
        import codesearch.indexserver.watcher as _wmod
        self._wmod = _wmod
        self.tmpdir = tempfile.mkdtemp(prefix="ts_handler_test_")
        self.mock_client = _MockTypesenseClient(self.COLL)
        self.handler = _wmod.CsChangeHandler(
            self.mock_client, self.tmpdir, collection=self.COLL
        )
        # Save and reset module-level stats so tests don't bleed into each other
        self._saved_stats = dict(_wmod._stats)
        with _wmod._stats_lock:
            _wmod._stats.update({"files_upserted": 0, "files_deleted": 0,
                                  "last_flush": None, "started_at": None})
        # Redirect stats writes to a temp file
        self._stats_tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self._stats_tmp.close()
        self._orig_stats_file = _wmod._STATS_FILE
        _wmod._STATS_FILE = _wmod.Path(self._stats_tmp.name)

    def tearDown(self):
        if self.handler._timer:
            self.handler._timer.cancel()
        shutil.rmtree(self.tmpdir, ignore_errors=True)
        os.unlink(self._stats_tmp.name)
        # Restore module state
        with self._wmod._stats_lock:
            self._wmod._stats.update(self._saved_stats)
        self._wmod._STATS_FILE = self._orig_stats_file

    def _cs_file(self, name: str = "Test.cs", content: str = "class Test {}") -> str:
        path = os.path.join(self.tmpdir, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    # ── event routing ──────────────────────────────────────────────────────────

    def test_on_created_cs_adds_upsert(self):
        path = self._cs_file()
        self.handler.on_created(_FakeEvent(path))
        with self.handler._lock:
            self.assertEqual(self.handler._pending.get(path), "upsert")

    def test_on_modified_cs_adds_upsert(self):
        path = self._cs_file()
        self.handler.on_modified(_FakeEvent(path))
        with self.handler._lock:
            self.assertEqual(self.handler._pending.get(path), "upsert")

    def test_on_deleted_cs_adds_delete(self):
        path = os.path.join(self.tmpdir, "Gone.cs")
        self.handler.on_deleted(_FakeEvent(path))
        with self.handler._lock:
            self.assertEqual(self.handler._pending.get(path), "delete")

    def test_on_created_non_indexed_ext_ignored(self):
        # .log is not in INCLUDE_EXTENSIONS; .txt IS indexed so don't use it here
        path = os.path.join(self.tmpdir, "build.log")
        self.handler.on_created(_FakeEvent(path))
        with self.handler._lock:
            self.assertNotIn(path, self.handler._pending)

    def test_on_created_directory_ignored(self):
        path = os.path.join(self.tmpdir, "subdir")
        self.handler.on_created(_FakeEvent(path, is_directory=True))
        with self.handler._lock:
            self.assertEqual(len(self.handler._pending), 0)

    def test_on_created_excluded_dir_skipped(self):
        excluded = os.path.join(self.tmpdir, "Target", "x64", "debug", "Foo.cs")
        self.handler.on_created(_FakeEvent(excluded))
        with self.handler._lock:
            self.assertNotIn(excluded, self.handler._pending,
                             "Files under excluded dirs should be ignored")

    def test_on_modified_deduplicates_same_file(self):
        path = self._cs_file()
        self.handler.on_modified(_FakeEvent(path))
        self.handler.on_modified(_FakeEvent(path))
        with self.handler._lock:
            self.assertEqual(list(self.handler._pending.keys()), [path],
                             "Same file should appear only once in pending")

    def test_on_moved_deletes_old_upserts_new(self):
        old_path = os.path.join(self.tmpdir, "Old.cs")
        new_path = self._cs_file("New.cs")
        self.handler.on_moved(_FakeEvent(old_path, dest_path=new_path))
        with self.handler._lock:
            self.assertEqual(self.handler._pending.get(old_path), "delete",
                             "moved-from path should be deleted")
            self.assertEqual(self.handler._pending.get(new_path), "upsert",
                             "moved-to path should be upserted")

    def test_on_moved_to_non_indexed_ext_only_deletes(self):
        # .log is not indexed; moving .cs → .log should only delete the old path
        old_path = os.path.join(self.tmpdir, "Foo.cs")
        new_path = os.path.join(self.tmpdir, "Foo.log")
        self.handler.on_moved(_FakeEvent(old_path, dest_path=new_path))
        with self.handler._lock:
            self.assertEqual(self.handler._pending.get(old_path), "delete")
            self.assertNotIn(new_path, self.handler._pending)

    def test_on_moved_from_non_indexed_ext_only_upserts(self):
        # .log is not indexed; moving .log → .cs should only upsert the new path
        old_path = os.path.join(self.tmpdir, "Foo.log")
        new_path = self._cs_file("Foo.cs")
        self.handler.on_moved(_FakeEvent(old_path, dest_path=new_path))
        with self.handler._lock:
            self.assertNotIn(old_path, self.handler._pending)
            self.assertEqual(self.handler._pending.get(new_path), "upsert")

    # ── debounce timer ─────────────────────────────────────────────────────────

    def test_debounce_timer_is_started(self):
        path = self._cs_file()
        self.handler.on_created(_FakeEvent(path))
        self.assertIsNotNone(self.handler._timer, "Timer should be set after event")

    def test_debounce_timer_reset_on_second_event(self):
        path1 = self._cs_file("A.cs")
        path2 = self._cs_file("B.cs")
        self.handler.on_created(_FakeEvent(path1))
        first_timer = self.handler._timer
        self.handler.on_created(_FakeEvent(path2))
        self.assertIsNot(self.handler._timer, first_timer,
                         "Timer should be replaced (reset) on each new event")

    # ── flush logic ────────────────────────────────────────────────────────────

    def test_flush_upserts_existing_file(self):
        path = self._cs_file()
        self.handler._pending[path] = "upsert"
        self.handler._flush()
        docs = self.mock_client.collections[self.COLL].documents
        self.assertEqual(len(docs.upserted), 1)
        self.assertEqual(docs.upserted[0]["filename"], "Test.cs")

    def test_flush_skips_nonexistent_upsert(self):
        path = os.path.join(self.tmpdir, "Missing.cs")
        self.handler._pending[path] = "upsert"
        self.handler._flush()
        docs = self.mock_client.collections[self.COLL].documents
        self.assertEqual(len(docs.upserted), 0,
                         "Non-existent file should not be sent to Typesense")

    def test_flush_deletes_document(self):
        path = os.path.join(self.tmpdir, "myapp/Gone.cs")
        self.handler._pending[path] = "delete"
        self.handler._flush()
        docs = self.mock_client.collections[self.COLL].documents
        self.assertEqual(len(docs.deleted), 1)

    def test_flush_clears_pending(self):
        path = self._cs_file()
        self.handler._pending[path] = "upsert"
        self.handler._flush()
        with self.handler._lock:
            self.assertEqual(len(self.handler._pending), 0,
                             "pending should be cleared after flush")

    def test_flush_empty_pending_is_noop(self):
        self.handler._flush()
        docs = self.mock_client.collections[self.COLL].documents
        self.assertEqual(len(docs.upserted), 0)
        self.assertEqual(len(docs.deleted), 0)

    # ── stats ──────────────────────────────────────────────────────────────────

    def test_stats_upserted_incremented(self):
        path = self._cs_file()
        self.handler._pending[path] = "upsert"
        self.handler._flush()
        with self._wmod._stats_lock:
            self.assertEqual(self._wmod._stats["files_upserted"], 1)

    def test_stats_deleted_incremented(self):
        path = os.path.join(self.tmpdir, "myapp/Gone.cs")
        self.handler._pending[path] = "delete"
        self.handler._flush()
        with self._wmod._stats_lock:
            self.assertEqual(self._wmod._stats["files_deleted"], 1)

    def test_stats_not_incremented_on_empty_flush(self):
        self.handler._flush()
        with self._wmod._stats_lock:
            self.assertEqual(self._wmod._stats["files_upserted"], 0)
            self.assertEqual(self._wmod._stats["files_deleted"], 0)

    def test_stats_file_written_after_upsert(self):
        path = self._cs_file()
        self.handler._pending[path] = "upsert"
        self.handler._flush()
        stats_path = str(self._wmod._STATS_FILE)
        self.assertTrue(os.path.exists(stats_path), "stats file should be written")
        with open(stats_path) as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk["files_upserted"], 1)

    def test_stats_accumulate_across_flushes(self):
        for i in range(3):
            path = self._cs_file(f"File{i}.cs", f"class File{i} {{}}")
            self.handler._pending[path] = "upsert"
            self.handler._flush()
        with self._wmod._stats_lock:
            self.assertEqual(self._wmod._stats["files_upserted"], 3)

    def test_stats_last_flush_set(self):
        path = self._cs_file()
        self.handler._pending[path] = "upsert"
        self.handler._flush()
        with self._wmod._stats_lock:
            self.assertIsNotNone(self._wmod._stats["last_flush"])


# ── test: CsChangeHandler integration (Typesense required) ───────────────────

@unittest.skipUnless(_server_ok(), "Typesense not running — start with: ts start")
class TestCsChangeHandlerIntegration(unittest.TestCase):
    """Integration tests: handler → real Typesense collection.

    Calls _flush() directly (no PollingObserver) to keep tests fast.
    """

    @classmethod
    def setUpClass(cls):
        import typesense as _ts
        from codesearch.indexserver.config import TYPESENSE_CLIENT_CONFIG
        from codesearch.indexserver.indexer import build_schema

        stamp = int(time.time())
        cls.coll = f"test_watcher_{stamp}"
        cls.client = _ts.Client(TYPESENSE_CLIENT_CONFIG)
        cls.client.collections.create(build_schema(cls.coll))
        cls.tmpdir = tempfile.mkdtemp(prefix="ts_wint_test_")
        subprocess.run(["git", "-C", cls.tmpdir, "init", "-q"], check=True)

    @classmethod
    def tearDownClass(cls):
        _delete_collection(cls.coll)
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _make_handler(self):
        import codesearch.indexserver.watcher as _wmod
        return _wmod.CsChangeHandler(self.client, self.tmpdir, collection=self.coll)

    def _write(self, name: str, content: str) -> str:
        path = os.path.join(self.tmpdir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def test_flush_indexes_new_file(self):
        handler = self._make_handler()
        path = self._write("sub/Widget.cs", "namespace Sub { public class Widget {} }")
        handler._pending[path] = "upsert"
        handler._flush()
        time.sleep(0.2)

        hits = _search(self.coll, "Widget")
        names = [h["filename"] for h in hits]
        self.assertIn("Widget.cs", names, f"Widget.cs not found; hits: {names}")

    def test_flush_updates_modified_file(self):
        handler = self._make_handler()
        path = self._write("sub/Gadget.cs", "namespace Sub { public class GadgetOld {} }")
        handler._pending[path] = "upsert"
        handler._flush()
        time.sleep(0.2)

        # Now update the file content
        with open(path, "w", encoding="utf-8") as f:
            f.write("namespace Sub { public class GadgetNew {} }")
        handler._pending[path] = "upsert"
        handler._flush()
        time.sleep(0.2)

        hits = _search(self.coll, "GadgetNew", query_by="class_names,symbols,content")
        names = [h["filename"] for h in hits]
        self.assertIn("Gadget.cs", names, "Updated file should be findable by new class name")

    def test_flush_removes_deleted_file(self):
        handler = self._make_handler()
        path = self._write("sub/Ephemeral.cs", "public class Ephemeral {}")
        handler._pending[path] = "upsert"
        handler._flush()
        time.sleep(0.2)

        # Confirm it's indexed
        hits_before = _search(self.coll, "Ephemeral")
        self.assertTrue(any(h["filename"] == "Ephemeral.cs" for h in hits_before),
                        "File should be indexed before deletion")

        # Now mark as deleted
        handler._pending[path] = "delete"
        handler._flush()
        time.sleep(0.2)

        hits_after = _search(self.coll, "Ephemeral")
        self.assertFalse(any(h["filename"] == "Ephemeral.cs" for h in hits_after),
                         "Deleted file should no longer appear in search results")

    def test_flush_stats_updated_on_real_upsert(self):
        import codesearch.indexserver.watcher as _wmod
        with _wmod._stats_lock:
            _wmod._stats["files_upserted"] = 0
        handler = self._make_handler()
        path = self._write("sub/Counted.cs", "public class Counted {}")
        handler._pending[path] = "upsert"
        handler._flush()
        with _wmod._stats_lock:
            self.assertGreater(_wmod._stats["files_upserted"], 0,
                               "stats.files_upserted should increment after real upsert")


# ── sample Python source ──────────────────────────────────────────────────────

_FOO_PY = """\
import os
from typing import Optional

class IFoo:
    def process(self, data: str) -> None:
        pass

class IComparable:
    def compare(self, other) -> int:
        return 0

def dataclass(cls):
    return cls

@dataclass
class Foo(IFoo, IComparable):
    name: str = ""

    def process(self, data: str) -> None:
        print(data)

    def compute(self, value: int) -> Optional[str]:
        return str(value)
"""

_BAR_PY = """\
from myapp.foo import Foo

class Bar(Foo):
    def __init__(self, foo: Foo) -> None:
        self._foo = foo

    def run(self) -> None:
        self._foo.process("hello")
"""


# ── test: extract_py_metadata unit tests (no server) ─────────────────────────

class TestExtractPyMetadata(unittest.TestCase):
    """Unit tests for extract_py_metadata — no server needed."""

    def _meta(self, src):
        return extract_py_metadata(src.encode())

    def test_class_names(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("Foo", meta["class_names"],
                      f"class_names: {meta['class_names']}")

    def test_class_names_multiple(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("IFoo", meta["class_names"],
                      f"class_names: {meta['class_names']}")

    def test_base_types_interface(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("IFoo", meta["base_types"],
                      f"base_types: {meta['base_types']}")

    def test_base_types_multiple(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("IComparable", meta["base_types"],
                      f"base_types: {meta['base_types']}")

    def test_base_types_subclass(self):
        meta = self._meta(_BAR_PY)
        self.assertIn("Foo", meta["base_types"],
                      f"base_types for Bar: {meta['base_types']}")

    def test_method_names(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("process", meta["method_names"],
                      f"method_names: {meta['method_names']}")

    def test_method_names_multiple(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("compute", meta["method_names"],
                      f"method_names: {meta['method_names']}")

    def test_method_sigs_contains_function_name(self):
        meta = self._meta(_FOO_PY)
        sigs = meta["method_sigs"]
        self.assertTrue(any("process" in s for s in sigs),
                        f"method_sigs: {sigs}")

    def test_method_sigs_include_return_type(self):
        meta = self._meta(_FOO_PY)
        sigs = meta["method_sigs"]
        self.assertTrue(any("Optional" in s for s in sigs),
                        f"method_sigs should include return type: {sigs}")

    def test_call_sites(self):
        meta = self._meta(_BAR_PY)
        self.assertIn("process", meta["call_sites"],
                      f"call_sites: {meta['call_sites']}")

    def test_decorators_in_attributes(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("dataclass", meta["attributes"],
                      f"attributes (decorators): {meta['attributes']}")

    def test_imports_in_usings(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("os", meta["usings"],
                      f"usings (imports): {meta['usings']}")

    def test_from_imports_in_usings(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("typing", meta["usings"],
                      f"usings (from-imports): {meta['usings']}")

    def test_from_imports_top_level_module(self):
        meta = self._meta(_BAR_PY)
        self.assertIn("myapp", meta["usings"],
                      f"usings should contain top-level 'myapp': {meta['usings']}")

    def test_type_refs_from_annotations(self):
        meta = self._meta(_FOO_PY)
        self.assertIn("Optional", meta["type_refs"],
                      f"type_refs: {meta['type_refs']}")

    def test_namespace_empty(self):
        meta = self._meta(_FOO_PY)
        self.assertEqual(meta["namespace"], "",
                         "Python files have no namespace")


# ── test: process_py_file / query_py modes (no server) ───────────────────────

class TestQueryPy(unittest.TestCase):
    """Unit tests for process_py_file() — no server needed.

    Verifies:
    1. Each query mode extracts the expected output from sample Python files.
    2. The AST fields extract_py_metadata indexes are consistent with process_py_file.
    """

    @classmethod
    def setUpClass(cls):
        cls.tmpdir = tempfile.mkdtemp(prefix="ts_qpy_test_")
        cls.foo_path = os.path.join(cls.tmpdir, "foo.py")
        cls.bar_path = os.path.join(cls.tmpdir, "bar.py")
        with open(cls.foo_path, "w", encoding="utf-8") as f:
            f.write(_FOO_PY)
        with open(cls.bar_path, "w", encoding="utf-8") as f:
            f.write(_BAR_PY)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _run(self, path, mode, mode_arg=None):
        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        try:
            n = _query_process_py_file(
                path=path, mode=mode, mode_arg=mode_arg,
                show_path=True, count_only=False, context=0,
                src_root=self.tmpdir,
            )
        finally:
            sys.stdout = old
        return n or 0, buf.getvalue()

    # ── mode: classes ──────────────────────────────────────────────────────────

    def test_classes_lists_foo(self):
        n, out = self._run(self.foo_path, "classes")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    def test_classes_shows_base_types(self):
        n, out = self._run(self.foo_path, "classes")
        self.assertIn("IFoo", out)

    def test_classes_multiple_bases(self):
        n, out = self._run(self.foo_path, "classes")
        self.assertIn("IComparable", out)

    # ── mode: methods ──────────────────────────────────────────────────────────

    def test_methods_lists_process(self):
        n, out = self._run(self.foo_path, "methods")
        self.assertGreater(n, 0)
        self.assertIn("process", out)

    def test_methods_lists_compute(self):
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("compute", out)

    def test_methods_shows_class_context(self):
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("[in Foo]", out)

    def test_methods_shows_return_type(self):
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("Optional", out)

    # ── mode: calls ───────────────────────────────────────────────────────────

    def test_calls_found_in_bar(self):
        n, out = self._run(self.bar_path, "calls", "process")
        self.assertGreater(n, 0)
        self.assertIn("process", out)

    def test_calls_absent_method_no_match(self):
        n, out = self._run(self.foo_path, "calls", "nonexistent_function_xyz")
        self.assertEqual(n, 0)

    # ── mode: implements ──────────────────────────────────────────────────────

    def test_implements_ifoo_finds_foo(self):
        n, out = self._run(self.foo_path, "implements", "IFoo")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    def test_implements_foo_finds_bar(self):
        n, out = self._run(self.bar_path, "implements", "Foo")
        self.assertGreater(n, 0)
        self.assertIn("Bar", out)

    def test_implements_nonexistent_no_match(self):
        n, out = self._run(self.foo_path, "implements", "INonExistent999")
        self.assertEqual(n, 0)

    # ── mode: ident ───────────────────────────────────────────────────────────

    def test_ident_finds_foo(self):
        n, out = self._run(self.foo_path, "ident", "Foo")
        self.assertGreater(n, 0)
        self.assertIn("Foo", out)

    def test_ident_absent_no_match(self):
        n, out = self._run(self.foo_path, "ident", "ZZZNonExistentXXX")
        self.assertEqual(n, 0)

    # ── mode: find ────────────────────────────────────────────────────────────

    def test_find_returns_source(self):
        n, out = self._run(self.foo_path, "find", "process")
        self.assertGreater(n, 0)
        self.assertIn("process", out)
        self.assertIn("def process", out)

    def test_find_class_returns_full_body(self):
        n, out = self._run(self.foo_path, "find", "Foo")
        self.assertGreater(n, 0)
        self.assertIn("class Foo", out)

    # ── mode: decorators ──────────────────────────────────────────────────────

    def test_decorators_found(self):
        n, out = self._run(self.foo_path, "decorators")
        self.assertGreater(n, 0)
        self.assertIn("dataclass", out)

    def test_decorators_filtered_by_name(self):
        n, out = self._run(self.foo_path, "decorators", "dataclass")
        self.assertGreater(n, 0)
        self.assertIn("dataclass", out)

    def test_decorators_filter_no_match(self):
        n, out = self._run(self.foo_path, "decorators", "nonexistent_decorator_xyz")
        self.assertEqual(n, 0)

    # ── mode: imports ─────────────────────────────────────────────────────────

    def test_imports_found(self):
        n, out = self._run(self.foo_path, "imports")
        self.assertGreater(n, 0)
        self.assertIn("import", out)

    def test_imports_shows_os(self):
        n, out = self._run(self.foo_path, "imports")
        self.assertIn("os", out)

    def test_imports_shows_from_import(self):
        n, out = self._run(self.foo_path, "imports")
        self.assertIn("typing", out)

    # ── mode: params ──────────────────────────────────────────────────────────

    def test_params_found(self):
        n, out = self._run(self.foo_path, "params", "process")
        self.assertGreater(n, 0)

    def test_params_shows_types(self):
        n, out = self._run(self.foo_path, "params", "process")
        self.assertIn("str", out)

    # ── relative path display ─────────────────────────────────────────────────

    def test_display_path_is_relative(self):
        n, out = self._run(self.foo_path, "classes")
        self.assertGreater(n, 0)
        self.assertIn("foo.py", out)
        tmpdir_norm = self.tmpdir.replace("\\", "/")
        self.assertNotIn(tmpdir_norm, out,
                         f"full tmpdir path leaked into output:\n{out}")

    # ── consistency: process_py_file ↔ extract_py_metadata ───────────────────

    def test_class_names_consistent(self):
        """class_names from indexer match what process_py_file classes mode finds."""
        meta = extract_py_metadata(_FOO_PY.encode())
        self.assertIn("Foo", meta["class_names"])
        n, out = self._run(self.foo_path, "classes")
        self.assertIn("Foo", out)

    def test_base_types_consistent(self):
        """base_types from indexer match what process_py_file implements mode uses."""
        meta = extract_py_metadata(_FOO_PY.encode())
        self.assertIn("IFoo", meta["base_types"])
        n, out = self._run(self.foo_path, "implements", "IFoo")
        self.assertGreater(n, 0)

    def test_method_names_consistent(self):
        """method_names from indexer match what process_py_file methods mode finds."""
        meta = extract_py_metadata(_FOO_PY.encode())
        self.assertIn("process", meta["method_names"])
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("process", out)

    def test_call_sites_consistent(self):
        """call_sites from indexer match what process_py_file calls mode finds."""
        meta = extract_py_metadata(_BAR_PY.encode())
        self.assertIn("process", meta["call_sites"])
        n, out = self._run(self.bar_path, "calls", "process")
        self.assertGreater(n, 0)

    def test_decorators_consistent(self):
        """attributes (decorators) from indexer match process_py_file decorators mode."""
        meta = extract_py_metadata(_FOO_PY.encode())
        self.assertIn("dataclass", meta["attributes"])
        n, out = self._run(self.foo_path, "decorators", "dataclass")
        self.assertGreater(n, 0)

    def test_imports_consistent(self):
        """usings (imports) from indexer match process_py_file imports mode."""
        meta = extract_py_metadata(_FOO_PY.encode())
        self.assertIn("os", meta["usings"])
        n, out = self._run(self.foo_path, "imports")
        self.assertIn("os", out)

    def test_method_sigs_consistent(self):
        """method_sigs from indexer match what process_py_file methods mode shows."""
        meta = extract_py_metadata(_FOO_PY.encode())
        sigs = meta["method_sigs"]
        self.assertTrue(any("process" in s for s in sigs), f"method_sigs: {sigs}")
        n, out = self._run(self.foo_path, "methods")
        self.assertIn("process", out)


# ── test: Python semantic fields indexed by Typesense ────────────────────────

@unittest.skipUnless(_server_ok(), "Typesense not running — start with: ts start")
class TestPySemanticFields(unittest.TestCase):
    """Verify that Python files get their semantic fields indexed by Typesense."""

    @classmethod
    def setUpClass(cls):
        stamp = int(time.time())
        cls.coll = f"test_pysem_{stamp}"
        cls.tmpdir = _make_git_repo({
            "myapp/foo.py": _FOO_PY,
            "myapp/bar.py": _BAR_PY,
        })
        run_index(src_root=cls.tmpdir, collection=cls.coll, reset=True, verbose=False)
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        _delete_collection(cls.coll)
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _get(self, filename):
        hits = _search(self.coll, os.path.splitext(filename)[0],
                       query_by="filename,symbols,class_names,method_names,content")
        return next((h for h in hits if h["filename"] == filename), None)

    def test_py_class_names_indexed(self):
        foo = self._get("foo.py")
        self.assertIsNotNone(foo, "foo.py not found in index")
        self.assertIn("Foo", foo.get("class_names", []),
                      f"class_names: {foo.get('class_names')}")

    def test_py_method_names_indexed(self):
        foo = self._get("foo.py")
        self.assertIsNotNone(foo)
        self.assertIn("process", foo.get("method_names", []),
                      f"method_names: {foo.get('method_names')}")

    def test_py_base_types_indexed(self):
        foo = self._get("foo.py")
        self.assertIsNotNone(foo)
        self.assertIn("IFoo", foo.get("base_types", []),
                      f"base_types: {foo.get('base_types')}")

    def test_py_subclass_base_types_indexed(self):
        bar = self._get("bar.py")
        self.assertIsNotNone(bar, "bar.py not found in index")
        self.assertIn("Foo", bar.get("base_types", []),
                      f"base_types for Bar: {bar.get('base_types')}")

    def test_py_call_sites_indexed(self):
        bar = self._get("bar.py")
        self.assertIsNotNone(bar)
        self.assertIn("process", bar.get("call_sites", []),
                      f"call_sites: {bar.get('call_sites')}")

    def test_py_decorators_in_attributes(self):
        foo = self._get("foo.py")
        self.assertIsNotNone(foo)
        self.assertIn("dataclass", foo.get("attributes", []),
                      f"attributes (decorators): {foo.get('attributes')}")

    def test_py_imports_in_usings(self):
        foo = self._get("foo.py")
        self.assertIsNotNone(foo)
        self.assertIn("os", foo.get("usings", []),
                      f"usings: {foo.get('usings')}")

    def test_py_base_types_searchable_via_typesense(self):
        """'implements' mode: query_by=base_types finds foo.py via IFoo."""
        hits = _search(self.coll, "IFoo", query_by="base_types,class_names,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("foo.py", names,
                      f"base_types query for 'IFoo' → {names}")

    def test_py_call_sites_searchable_via_typesense(self):
        """'callers' mode: query_by=call_sites finds bar.py via process."""
        hits = _search(self.coll, "process", query_by="call_sites,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("bar.py", names,
                      f"call_sites query for 'process' → {names}")

    def test_py_method_sigs_searchable_via_typesense(self):
        """'sig' mode: query_by=method_sigs finds foo.py via process."""
        hits = _search(self.coll, "process", query_by="method_sigs,method_names,filename")
        names = [h["filename"] for h in hits]
        self.assertIn("foo.py", names,
                      f"method_sigs query for 'process' → {names}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
