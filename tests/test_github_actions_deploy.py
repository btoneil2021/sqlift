from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"


def test_workflow_triggers_on_push_to_main_and_manual_dispatch():
    text = WORKFLOW.read_text()

    assert "workflow_dispatch:" in text
    assert "- main" in text


def test_workflow_uses_github_actions_to_deploy_production():
    text = WORKFLOW.read_text()

    assert "vercel pull --yes --environment=production" in text
    assert "vercel deploy --prod --yes" in text
    assert "VERCEL_TOKEN" in text


def test_workflow_smoke_tests_the_live_backend_route():
    text = WORKFLOW.read_text()

    assert "curl -fsSL \"$LIVE_URL/api/hello\"" in text
    assert "Hello from Flask on Vercel!" in text
