import io
import json
import subprocess
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch

from scripts.check_supabase import check
from api.app import app

URL = 'https://example.com/api/supabase/keepalive'
OK = {'status': 'ok', 'connected': True, 'result': 1}


def response(payload):
    return subprocess.CompletedProcess([], 0, json.dumps(payload).encode() + b"\n200")


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.out = io.StringIO()
        self.err = io.StringIO()
        self.enterContext(redirect_stdout(self.out))
        self.enterContext(redirect_stderr(self.err))

    @patch('scripts.check_supabase.subprocess.run', return_value=response(OK))
    def test_success_and_request_bounds(self, run):
        self.assertTrue(check(URL))
        args, kwargs = run.call_args
        self.assertIn('--max-time', args[0])
        self.assertIn('--connect-timeout', args[0])
        self.assertNotIn('--location', args[0])
        self.assertEqual(kwargs['timeout'], 35)
        run.assert_called_once()

    @patch('scripts.check_supabase.time.sleep')
    @patch('scripts.check_supabase.subprocess.run')
    def test_retry_transient_network_failure(self, run, sleep):
        run.side_effect = [subprocess.CalledProcessError(22, 'curl'), response(OK)]
        self.assertTrue(check(URL))
        self.assertEqual(run.call_count, 2)
        sleep.assert_called_once_with(15)

    @patch('scripts.check_supabase.time.sleep')
    @patch('scripts.check_supabase.subprocess.run')
    def test_timeout_exhaustion_is_bounded_and_redacted(self, run, sleep):
        run.side_effect = subprocess.TimeoutExpired('curl', 35, output='private diagnostic')
        self.assertFalse(check(URL))
        self.assertEqual(run.call_count, 3)
        self.assertEqual(sleep.call_count, 2)
        self.assertNotIn('private diagnostic', self.out.getvalue() + self.err.getvalue())

    @patch('scripts.check_supabase.subprocess.run')
    def test_rejects_false_positive_payloads(self, run):
        for payload in [[], None, {'status': 'ok'},
                        {**OK, 'connected': False}, {**OK, 'result': None},
                        {**OK, 'result': True}, {**OK, 'result': '1'},
                        {'error': {'status': 'ok'}}, {**OK, 'status': 'error'}]:
            with self.subTest(payload=payload):
                run.return_value = response(payload)
                self.assertFalse(check(URL, attempts=1))

    @patch('scripts.check_supabase.subprocess.run')
    def test_rejects_html_and_malformed_json_without_logging_body(self, run):
        for body in [b'<html>private diagnostic</html>', b'{"status":"ok"', b'\xff']:
            run.return_value = subprocess.CompletedProcess([], 0, body + b'\n200')
            self.assertFalse(check(URL, attempts=1))
        self.assertNotIn('private diagnostic', self.err.getvalue())

    @patch('scripts.check_supabase.subprocess.run')
    def test_rejects_redirect_with_healthy_json_body(self, run):
        for status in [b'301', b'302', b'307', b'308', b'204']:
            run.return_value = subprocess.CompletedProcess(
                [], 0, json.dumps(OK).encode() + b'\n' + status)
            self.assertFalse(check(URL, attempts=1))

    @patch('scripts.check_supabase.subprocess.run')
    def test_rejects_missing_insecure_and_credential_urls(self, run):
        for url in ['', 'http://example.com', 'https://user:password@example.com']:
            with self.assertRaises(ValueError):
                check(url)
        run.assert_not_called()


class EndpointTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True, RATELIMIT_ENABLED=False)
        self.client = app.test_client()
        self.connect = self.enterContext(patch('api.utils.psycopg.connect'))
        self.enterContext(patch('api.utils.get_database_url', return_value='test-only'))
        self.conn = self.connect.return_value.__enter__.return_value
        self.cursor = self.conn.cursor.return_value.__enter__.return_value

    def test_real_route_queries_database_and_disables_cache(self):
        self.cursor.fetchone.return_value = (1,)
        result = self.client.get('/api/supabase/keepalive')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json, OK)
        self.assertEqual(result.headers['Cache-Control'], 'no-store')
        self.cursor.execute.assert_called_once_with('SELECT 1 AS ok')

    def test_missing_database_result_fails(self):
        for row in [None, (0,)]:
            self.cursor.fetchone.return_value = row
            result = self.client.get('/api/supabase/keepalive')
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.headers['Cache-Control'], 'no-store')

    def test_database_unavailable_fails_and_is_not_cached(self):
        self.connect.side_effect = RuntimeError('database unavailable')
        with patch.object(app.logger, 'exception'):
            result = self.client.get('/api/supabase/keepalive')
        self.assertEqual(result.status_code, 500)
        self.assertFalse(result.json['connected'])
        self.assertEqual(result.headers['Cache-Control'], 'no-store')

    def test_vercel_cron_uses_database_route_once_daily(self):
        config = json.loads(Path('vercel.json').read_text())
        self.assertEqual(config['crons'], [
            {'path': '/api/supabase/keepalive', 'schedule': '17 3 * * *'}])
        self.assertTrue(any(rule['source'] == '/api/(.*)' and
                            rule['destination'] == '/api/app.py'
                            for rule in config['rewrites']))


if __name__ == '__main__':
    unittest.main()
