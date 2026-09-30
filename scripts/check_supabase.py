"""Check the existing public health route without credentials or data writes."""

import json
import os
import subprocess
import sys
import time
from urllib.parse import urlsplit


def check(url, attempts=3, delay=15):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("KEEPALIVE_URL must be an HTTPS URL without credentials")
    for attempt in range(1, attempts + 1):
        try:
            # Bound the whole request; never follow redirects or log bodies.
            response = subprocess.run(
                ["curl", "--fail", "--silent", "--show-error",
                 "--connect-timeout", "10", "--max-time", "30",
                 "--max-filesize", "4096", "--header", "Cache-Control: no-cache",
                 "--url", url],
                capture_output=True, check=True, timeout=35,
            )
            payload = json.loads(response.stdout)
            if (isinstance(payload, dict) and payload.get("status") == "ok"
                    and payload.get("connected") is True
                    and type(payload.get("result")) is int and payload["result"] == 1):
                print("Supabase database health check passed.")
                return True
        except (subprocess.SubprocessError, OSError, ValueError):
            pass
        print(f"Database health check attempt {attempt}/{attempts} failed.", file=sys.stderr)
        if attempt < attempts:
            time.sleep(delay)
    return False


if __name__ == "__main__":
    try:
        healthy = check(os.environ.get("KEEPALIVE_URL", ""))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        healthy = False
    sys.exit(0 if healthy else 1)
