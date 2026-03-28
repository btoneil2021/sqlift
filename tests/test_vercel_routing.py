import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_api_catch_all_entrypoint_exists_and_serves_hello():
    catch_all = ROOT / "api" / "[...path].py"
    assert catch_all.exists(), "Expected a catch-all Vercel API entrypoint at api/[...path].py"

    module = load_module(catch_all, "vercel_catch_all")
    client = module.app.test_client()
    response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.get_json() == {"message": "Hello from Flask on Vercel!"}


def test_vercel_config_does_not_rewrite_all_api_requests_to_index():
    config_path = ROOT / "vercel.json"
    if not config_path.exists():
        return

    config = json.loads(config_path.read_text())
    rewrites = config.get("rewrites", [])

    bad_rule = {
        "source": "/api/(.*)",
        "destination": "/api/index.py",
    }

    assert bad_rule not in rewrites


def test_deploy_workflow_does_not_use_prebuilt_output_for_python_api():
    workflow_path = ROOT / ".github" / "workflows" / "deploy.yml"
    text = workflow_path.read_text()

    assert "vercel build --prod" not in text
    assert "vercel deploy --prebuilt --prod" not in text
