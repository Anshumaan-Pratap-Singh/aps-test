/* Python execution worker (Pyodide/WebAssembly). Runs entirely in the user's browser sandbox:
   no filesystem or network access to the host, and the page terminates this worker on timeout. */
// Paths are relative to this worker so the site also works under a base path (GitHub Pages).
const PYODIDE_URL = new URL("pyodide/", self.location.href).href;
importScripts(PYODIDE_URL + "pyodide.js");
let pyReady = loadPyodide({ indexURL: PYODIDE_URL });

const HARNESS = `
import sys, io, traceback, time
def __aps_run(user_code, tests):
    results = []
    ns = {"__name__": "__main__"}
    out = io.StringIO()
    old = sys.stdout
    sys.stdout = out
    try:
        t0 = time.perf_counter()
        exec(compile(user_code, "solution.py", "exec"), ns)
        compile_ms = (time.perf_counter() - t0) * 1000
    except Exception:
        sys.stdout = old
        return {"compile_error": traceback.format_exc(limit=3), "results": [], "stdout": out.getvalue()}
    for name, code, hidden in tests:
        env = dict(ns)
        t0 = time.perf_counter()
        try:
            exec(compile(code, name, "exec"), env)
            results.append({"name": name, "passed": True, "hidden": hidden, "ms": (time.perf_counter() - t0) * 1000})
        except AssertionError as e:
            results.append({"name": name, "passed": False, "hidden": hidden, "error": "AssertionError: " + str(e), "ms": (time.perf_counter() - t0) * 1000})
        except Exception:
            results.append({"name": name, "passed": False, "hidden": hidden, "error": traceback.format_exc(limit=2).splitlines()[-1], "ms": (time.perf_counter() - t0) * 1000})
    sys.stdout = old
    return {"compile_error": None, "results": results, "stdout": out.getvalue()[:4000]}
`;

self.onmessage = async (e) => {
  const { id, code, tests } = e.data;
  try {
    const py = await pyReady;
    py.runPython(HARNESS);
    const run = py.globals.get("__aps_run");
    const res = run(code, py.toPy(tests.map((t) => [t.name, t.code, !!t.hidden])));
    const js = res.toJs({ dict_converter: Object.fromEntries });
    res.destroy();
    self.postMessage({ id, ok: true, ...js });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
self.postMessage({ ready: "loading" });
