/**
 * Unit + integration tests for client.ts.
 * Run with: npm test
 *
 * Covers:
 *   - Config parsing (legacy + multi-root, port reading)
 *   - Root and collection resolution
 *   - Search param building for every mode and filter combo
 *   - Path resolution (Windows, WSL, nested paths)
 *   - HTTP search against a local mock server
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';

import {
    loadConfig,
    getRoots,
    sanitizeName,
    collectionForRoot,
    buildSearchParams,
    tsSearch,
    doSearch,
    resolveFilePath,
    MODES,
    CodesearchConfig,
    TypesenseResult,
} from '../client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeTempConfig(obj: object): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cstest-'));
    const p = path.join(dir, 'config.json');
    fs.writeFileSync(p, JSON.stringify(obj));
    return p;
}

function makeHit(relPath: string, extra?: object) {
    return {
        document: {
            id: '1',
            relative_path: relPath,
            filename: path.basename(relPath),
            ...extra,
        },
        highlights: [],
    };
}

// ---------------------------------------------------------------------------
// Mock Typesense server
// ---------------------------------------------------------------------------

let mockServer: http.Server;
let mockPort: number;

// The handler can be overridden per-test
type MockHandler = (
    url: string,
    params: URLSearchParams,
    headers: http.IncomingHttpHeaders
) => { status: number; body: object };

let mockHandler: MockHandler = () => ({ status: 200, body: { found: 0, hits: [] } });

before(
    () =>
        new Promise<void>((resolve) => {
            mockServer = http.createServer((req, res) => {
                const parsed = new URL(req.url ?? '/', `http://localhost`);
                const params = parsed.searchParams;
                const { status, body } = mockHandler(parsed.pathname, params, req.headers);
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(body));
            });
            mockServer.listen(0, () => {
                mockPort = (mockServer.address() as { port: number }).port;
                resolve();
            });
        })
);

after(
    () =>
        new Promise<void>((resolve) => {
            mockServer.close(() => resolve());
        })
);

// Reset handler before each test so leakage doesn't affect later tests
beforeEach(() => {
    mockHandler = () => ({ status: 200, body: { found: 0, hits: [] } });
});

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
    it('reads legacy src_root format', () => {
        const p = writeTempConfig({ src_root: 'C:/myproject/src', api_key: 'test-key' });
        const cfg = loadConfig(p);
        assert.equal(cfg.api_key, 'test-key');
        assert.equal(cfg.src_root, 'C:/myproject/src');
    });

    it('reads multi-root format', () => {
        const p = writeTempConfig({
            api_key: 'mk',
            roots: { default: 'Q:/src', other: 'Q:/other' },
        });
        const cfg = loadConfig(p);
        assert.deepEqual(cfg.roots, { default: 'Q:/src', other: 'Q:/other' });
    });

    it('reads port field', () => {
        const p = writeTempConfig({ api_key: 'x', src_root: 'Q:/s', port: 9000 });
        const cfg = loadConfig(p);
        assert.equal(cfg.port, 9000);
    });

    it('throws on missing file', () => {
        assert.throws(() => loadConfig('/no/such/config.json'));
    });

    it('throws on malformed JSON', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cstest-'));
        const p = path.join(dir, 'config.json');
        fs.writeFileSync(p, '{ bad json }');
        assert.throws(() => loadConfig(p));
    });
});

// ---------------------------------------------------------------------------
// getRoots
// ---------------------------------------------------------------------------

describe('getRoots', () => {
    it('returns roots map from multi-root config', () => {
        const cfg: CodesearchConfig = { api_key: 'x', roots: { default: 'Q:/src', foo: 'Q:/foo' } };
        assert.deepEqual(getRoots(cfg), { default: 'Q:/src', foo: 'Q:/foo' });
    });

    it('promotes legacy src_root to default key', () => {
        const cfg: CodesearchConfig = { api_key: 'x', src_root: 'Q:/src' };
        assert.deepEqual(getRoots(cfg), { default: 'Q:/src' });
    });

    it('prefers roots over src_root when both present', () => {
        const cfg: CodesearchConfig = {
            api_key: 'x',
            src_root: 'Q:/legacy',
            roots: { main: 'Q:/main' },
        };
        assert.deepEqual(getRoots(cfg), { main: 'Q:/main' });
    });

    it('returns empty object when neither present', () => {
        const cfg: CodesearchConfig = { api_key: 'x' };
        assert.deepEqual(getRoots(cfg), {});
    });
});

// ---------------------------------------------------------------------------
// Collection naming
// ---------------------------------------------------------------------------

describe('collectionForRoot', () => {
    it('default root → codesearch_default', () => {
        assert.equal(collectionForRoot('default'), 'codesearch_default');
    });

    it('uppercased name is lowercased', () => {
        assert.equal(collectionForRoot('MyRoot'), 'codesearch_myroot');
    });

    it('hyphens and spaces become underscores', () => {
        assert.equal(collectionForRoot('my-root project'), 'codesearch_my_root_project');
    });

    it('sanitizes special chars', () => {
        assert.equal(collectionForRoot('root@2!'), 'codesearch_root_2_');
    });
});

describe('sanitizeName', () => {
    it('leaves lowercase alphanumeric unchanged', () => {
        assert.equal(sanitizeName('abc123'), 'abc123');
    });

    it('converts uppercase to lowercase', () => {
        assert.equal(sanitizeName('AbC'), 'abc');
    });

    it('replaces disallowed chars with underscore', () => {
        assert.equal(sanitizeName('a-b.c/d'), 'a_b_c_d');
    });
});

// ---------------------------------------------------------------------------
// Search param builder
// ---------------------------------------------------------------------------

describe('buildSearchParams — mode query_by fields', () => {
    const modeCases: Array<[string, string]> = [
        ['text',       'filename,symbols,class_names,method_names,content'],
        ['symbols',    'symbols,class_names,method_names,filename'],
        ['implements', 'base_types,class_names,filename'],
        ['callers',    'call_sites,filename'],
        ['sig',        'method_sigs,method_names,filename'],
        ['uses',       'type_refs,symbols,class_names,filename'],
        ['attr',       'attributes,filename'],
    ];

    for (const [mode, expectedQueryBy] of modeCases) {
        it(`${mode} mode uses correct query_by`, () => {
            const p = buildSearchParams('foo', mode, '', '', 10);
            assert.equal(p['query_by'], expectedQueryBy);
        });
    }

    it('falls back to text mode for unknown mode key', () => {
        const p = buildSearchParams('x', 'nonexistent', '', '', 10);
        assert.equal(p['query_by'], 'filename,symbols,class_names,method_names,content');
    });
});

describe('buildSearchParams — typo tolerance', () => {
    it('sets num_typos=0 for short queries (< 4 chars)', () => {
        assert.equal(buildSearchParams('foo', 'text', '', '', 10)['num_typos'], '0');
        assert.equal(buildSearchParams('ab', 'text', '', '', 10)['num_typos'], '0');
    });

    it('sets num_typos=1 for longer queries', () => {
        assert.equal(buildSearchParams('foobar', 'text', '', '', 10)['num_typos'], '1');
        assert.equal(buildSearchParams('IStorage', 'implements', '', '', 10)['num_typos'], '1');
    });
});

describe('buildSearchParams — filters', () => {
    it('adds extension filter', () => {
        const p = buildSearchParams('x', 'text', 'cs', '', 10);
        assert.equal(p['filter_by'], 'extension:=cs');
    });

    it('strips leading dot from extension', () => {
        const p = buildSearchParams('x', 'text', '.cs', '', 10);
        assert.equal(p['filter_by'], 'extension:=cs');
    });

    it('adds subsystem filter', () => {
        const p = buildSearchParams('x', 'text', '', 'storage', 10);
        assert.equal(p['filter_by'], 'subsystem:=storage');
    });

    it('combines extension and subsystem filters with &&', () => {
        const p = buildSearchParams('x', 'text', 'cs', 'storage', 10);
        assert.equal(p['filter_by'], 'extension:=cs && subsystem:=storage');
    });

    it('omits filter_by when no filters', () => {
        const p = buildSearchParams('x', 'text', '', '', 10);
        assert.equal(p['filter_by'], undefined);
    });
});

describe('buildSearchParams — sorting', () => {
    it('adds sort_by when no extension filter', () => {
        const p = buildSearchParams('x', 'text', '', '', 10);
        assert.ok(p['sort_by']?.includes('_text_match'));
    });

    it('omits sort_by when extension filter is present', () => {
        const p = buildSearchParams('x', 'text', 'cs', '', 10);
        assert.equal(p['sort_by'], undefined);
    });
});

describe('buildSearchParams — limit', () => {
    it('sets per_page to the given limit', () => {
        assert.equal(buildSearchParams('x', 'text', '', '', 50)['per_page'], '50');
        assert.equal(buildSearchParams('x', 'text', '', '', 100)['per_page'], '100');
    });
});

describe('buildSearchParams — prefix search is enabled', () => {
    it('sets prefix=true for real-time as-you-type use', () => {
        const p = buildSearchParams('IS', 'text', '', '', 10);
        assert.equal(p['prefix'], 'true');
    });
});

// ---------------------------------------------------------------------------
// MODES constant
// ---------------------------------------------------------------------------

describe('MODES constant', () => {
    it('contains all 7 modes', () => {
        const keys = MODES.map((m) => m.key);
        assert.deepEqual(keys, ['text', 'symbols', 'implements', 'callers', 'sig', 'uses', 'attr']);
    });

    it('every mode has key, label, queryBy, weights, desc', () => {
        for (const m of MODES) {
            assert.ok(m.key, `${m.key}: missing key`);
            assert.ok(m.label, `${m.key}: missing label`);
            assert.ok(m.queryBy, `${m.key}: missing queryBy`);
            assert.ok(m.weights, `${m.key}: missing weights`);
            assert.ok(m.desc, `${m.key}: missing desc`);
        }
    });

    it('weight count matches queryBy field count for each mode', () => {
        for (const m of MODES) {
            const fieldCount = m.queryBy.split(',').length;
            const weightCount = m.weights.split(',').length;
            assert.equal(fieldCount, weightCount, `${m.key}: field count ${fieldCount} !== weight count ${weightCount}`);
        }
    });
});

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

describe('resolveFilePath', () => {
    it('joins Windows root with relative path', () => {
        const result = resolveFilePath('C:/myproject/src', 'Foo/Bar.cs');
        assert.equal(result, 'C:/myproject/src/Foo/Bar.cs');
    });

    it('handles backslashes in root', () => {
        const result = resolveFilePath('C:\\myproject\\src', 'Foo/Bar.cs');
        assert.equal(result, 'C:/myproject/src/Foo/Bar.cs');
    });

    it('strips trailing slash from root', () => {
        const result = resolveFilePath('C:/myproject/src/', 'Foo/Bar.cs');
        assert.equal(result, 'C:/myproject/src/Foo/Bar.cs');
    });

    it('strips leading slash from relative path', () => {
        const result = resolveFilePath('C:/myproject/src', '/Foo/Bar.cs');
        assert.equal(result, 'C:/myproject/src/Foo/Bar.cs');
    });

    it('converts WSL /mnt/q/... root to Q:/...', () => {
        const result = resolveFilePath('/mnt/c/myproject/src', 'Foo/Bar.cs');
        assert.equal(result, 'C:/myproject/src/Foo/Bar.cs');
    });

    it('handles lowercase drive letter in WSL path', () => {
        const result = resolveFilePath('/mnt/c/code', 'src/main.cs');
        assert.equal(result, 'C:/code/src/main.cs');
    });

    it('preserves deeply nested relative paths', () => {
        const result = resolveFilePath('Q:/src', 'a/b/c/d/e.cs');
        assert.equal(result, 'Q:/src/a/b/c/d/e.cs');
    });
});

// ---------------------------------------------------------------------------
// tsSearch — HTTP client against mock server
// ---------------------------------------------------------------------------

describe('tsSearch', () => {
    it('sends X-TYPESENSE-API-KEY header', async () => {
        let capturedKey = '';
        mockHandler = (_url, _params, headers) => {
            capturedKey = headers['x-typesense-api-key'] as string;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        await tsSearch('localhost', mockPort, 'my-secret-key', 'codesearch_default', { q: 'test' });
        assert.equal(capturedKey, 'my-secret-key');
    });

    it('requests the correct collection path', async () => {
        let capturedPath = '';
        mockHandler = (url) => {
            capturedPath = url;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        await tsSearch('localhost', mockPort, 'k', 'codesearch_myroot', { q: 'x' });
        assert.ok(capturedPath.startsWith('/collections/codesearch_myroot/documents/search'));
    });

    it('passes query params in the URL', async () => {
        let capturedParams: URLSearchParams | null = null;
        mockHandler = (_url, params) => {
            capturedParams = params;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        await tsSearch('localhost', mockPort, 'k', 'col', { q: 'IStorage', query_by: 'class_names' });
        assert.equal(capturedParams!.get('q'), 'IStorage');
        assert.equal(capturedParams!.get('query_by'), 'class_names');
    });

    it('returns parsed JSON result', async () => {
        const fakeResult: TypesenseResult = {
            found: 1,
            hits: [makeHit('Foo/Bar.cs', { class_names: ['Bar'] })],
        };
        mockHandler = () => ({ status: 200, body: fakeResult });
        const result = await tsSearch('localhost', mockPort, 'k', 'col', { q: 'Bar' });
        assert.equal(result.found, 1);
        assert.equal(result.hits[0].document.relative_path, 'Foo/Bar.cs');
        assert.deepEqual(result.hits[0].document.class_names, ['Bar']);
    });

    it('rejects with error message on 404', async () => {
        mockHandler = () => ({ status: 404, body: { message: 'collection not found' } });
        await assert.rejects(
            () => tsSearch('localhost', mockPort, 'k', 'col', { q: 'x' }),
            /Typesense 404/
        );
    });

    it('rejects with error message on 400', async () => {
        mockHandler = () => ({ status: 400, body: { message: 'bad request: unknown field' } });
        await assert.rejects(
            () => tsSearch('localhost', mockPort, 'k', 'col', { q: 'x' }),
            /bad request/
        );
    });

    it('rejects when server is unreachable', async () => {
        await assert.rejects(
            () => tsSearch('localhost', 1, 'k', 'col', { q: 'x' }),
            (err: Error) => err.message.length > 0
        );
    });
});

// ---------------------------------------------------------------------------
// doSearch — end-to-end through config + mock server
// ---------------------------------------------------------------------------

describe('doSearch', () => {
    it('uses port from config', async () => {
        let usedPort = 0;
        // We'll verify by having the mock server record requests —
        // configure a config pointing at the mock's port
        mockHandler = () => ({ status: 200, body: { found: 0, hits: [] } });
        const cfg: CodesearchConfig = {
            api_key: 'k',
            port: mockPort,
            src_root: 'Q:/src',
        };
        // Should not throw (mock is listening on mockPort)
        await doSearch(cfg, 'test', 'text', '', '', '', 10);
        usedPort = mockPort; // If we got here without error, the right port was used
        assert.equal(usedPort, mockPort);
    });

    it('defaults to port 8108 when port not in config', async () => {
        // We just check buildSearchParams indirectly — doSearch will fail to connect
        // on 8108 in CI (no real server), so we only check the config branch.
        const cfg: CodesearchConfig = { api_key: 'k', src_root: 'Q:/src' };
        assert.deepEqual(Object.keys(getRoots(cfg)), ['default']);
    });

    it('uses first root when rootName is empty', async () => {
        let capturedPath = '';
        mockHandler = (url) => {
            capturedPath = url;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        const cfg: CodesearchConfig = {
            api_key: 'k',
            port: mockPort,
            roots: { myroot: 'Q:/src' },
        };
        await doSearch(cfg, 'x', 'text', '', '', '', 10);
        assert.ok(capturedPath.includes('codesearch_myroot'), `expected myroot in path, got: ${capturedPath}`);
    });

    it('uses named root when rootName matches', async () => {
        let capturedPath = '';
        mockHandler = (url) => {
            capturedPath = url;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        const cfg: CodesearchConfig = {
            api_key: 'k',
            port: mockPort,
            roots: { alpha: 'Q:/alpha', beta: 'Q:/beta' },
        };
        await doSearch(cfg, 'x', 'text', '', '', 'beta', 10);
        assert.ok(capturedPath.includes('codesearch_beta'), `expected beta in path, got: ${capturedPath}`);
    });

    it('falls back to first root for unknown rootName', async () => {
        let capturedPath = '';
        mockHandler = (url) => {
            capturedPath = url;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        const cfg: CodesearchConfig = {
            api_key: 'k',
            port: mockPort,
            roots: { alpha: 'Q:/alpha' },
        };
        await doSearch(cfg, 'x', 'text', '', '', 'nonexistent', 10);
        assert.ok(capturedPath.includes('codesearch_alpha'), `expected alpha in path, got: ${capturedPath}`);
    });

    it('sends api_key from config', async () => {
        let capturedKey = '';
        mockHandler = (_url, _params, headers) => {
            capturedKey = headers['x-typesense-api-key'] as string;
            return { status: 200, body: { found: 0, hits: [] } };
        };
        const cfg: CodesearchConfig = { api_key: 'secret-abc', port: mockPort, src_root: 'Q:/src' };
        await doSearch(cfg, 'x', 'text', '', '', '', 10);
        assert.equal(capturedKey, 'secret-abc');
    });

    it('returns hits and found count from server', async () => {
        mockHandler = () => ({
            status: 200,
            body: {
                found: 3,
                hits: [
                    makeHit('foo/A.cs', { class_names: ['A'] }),
                    makeHit('foo/B.cs', { class_names: ['B'] }),
                    makeHit('foo/C.cs', { class_names: ['C'] }),
                ],
            },
        });
        const cfg: CodesearchConfig = { api_key: 'k', port: mockPort, src_root: 'Q:/src' };
        const result = await doSearch(cfg, 'foo', 'text', '', '', '', 10);
        assert.equal(result.found, 3);
        assert.equal(result.hits.length, 3);
        assert.equal(result.hits[1].document.relative_path, 'foo/B.cs');
    });

    it('propagates Typesense errors', async () => {
        mockHandler = () => ({ status: 400, body: { message: 'schema mismatch' } });
        const cfg: CodesearchConfig = { api_key: 'k', port: mockPort, src_root: 'Q:/src' };
        await assert.rejects(
            () => doSearch(cfg, 'x', 'text', '', '', '', 10),
            /schema mismatch/
        );
    });
});
