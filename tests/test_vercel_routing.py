import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_api_hello_function_exists_as_concrete_vercel_route():
    hello_path = ROOT / "api" / "hello.py"
    assert hello_path.exists(), "Expected a concrete Vercel route file at api/hello.py"

    text = hello_path.read_text()
    assert "class handler(BaseHTTPRequestHandler):" in text
    assert '"/api/hello"' not in text
    assert "Hello from Flask on Vercel!" in text


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
