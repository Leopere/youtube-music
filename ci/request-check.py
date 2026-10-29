#!/usr/bin/env python3
"""Submit and observe the exact pushed revision in the local Jenkins check job."""

import os
from pathlib import Path
import re
import subprocess
import sys
import time


def main():
    revision = os.environ.get('DEPLOY_IT_COMMIT', '')
    branch = os.environ.get('DEPLOY_IT_BRANCH', '')
    environment = os.environ.get('DEPLOY_IT_ENVIRONMENT', '')
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise SystemExit('DEPLOY_IT_COMMIT must be one full lowercase revision')
    if branch != 'master' or environment != 'ci-artifacts-only':
        raise SystemExit('This handoff only checks pushed master revisions and stores Jenkins artifacts')

    manager = Path.home() / 'dev' / 'jenkins-local' / 'manage-youtube-music-job.py'
    if not manager.is_file():
        raise SystemExit(f'Local Jenkins manager is unavailable: {manager}')
    requested_at_ms = str(time.time_ns() // 1_000_000)
    result = subprocess.run(
        [sys.executable, str(manager), 'run', '--source-commit', revision,
         '--requested-at-ms', requested_at_ms],
        check=False, timeout=295,
    )
    if result.returncode:
        raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
