#!/usr/bin/env python3
"""
Prepares and checks releases of Curly Brace. Run it before every push that changes the site.

Browsers keep files for up to 10 minutes, and the offline service worker keeps them until
the next release, so each release needs a new version in every file URL. A release:

  1. sets the new release version in index.html (every ?v=...) and in service-worker.js,
  2. recalculates the Content Security Policy hashes for the inline scripts in index.html
     (the import map changes with every version, so its hash changes too; a wrong hash stops the site),
  3. runs the same checks as --check below.

--check changes nothing. It stops with a list of problems if:
  - the versions in index.html and service-worker.js don't all agree,
  - the security policy hashes don't match the inline scripts,
  - a module in js/ is missing from the import map or the service worker, or a listed file doesn't exist,
  - CHANGELOG.md has no entry for the release's date.

Usage:
  python3 scripts/release.py              # today's date plus a counter, e.g. 2026-11-17.1
  python3 scripts/release.py 2026-12-01.1 # a version of your choice (never older than the current one)
  python3 scripts/release.py --check      # only check, for example in CI
"""
import base64
import datetime
import hashlib
import pathlib
import re
import sys

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX_FILE = PROJECT_ROOT / 'index.html'
SERVICE_WORKER_FILE = PROJECT_ROOT / 'service-worker.js'
CHANGELOG_FILE = PROJECT_ROOT / 'CHANGELOG.md'
MODULES_FOLDER = PROJECT_ROOT / 'js'
ENTRY_MODULE = 'main.js'

VERSION_PATTERN = r'\d{4}-\d{2}-\d{2}\.\d+'
VERSION_IN_URL = re.compile(r'\?v=(' + VERSION_PATTERN + ')')
VERSION_IN_WORKER = re.compile(r"const RELEASE = '(" + VERSION_PATTERN + ")';")
INLINE_SCRIPT = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.DOTALL)
SCRIPT_SOURCES_IN_POLICY = re.compile(r"script-src 'self'(?: '[^']+')*")
POLICY_HASH = re.compile(r"'(sha256-[A-Za-z0-9+/=]+)'")
IMPORT_MAP_ENTRY = re.compile(r'"\./(js/[\w-]+\.js)": "\./js/')
WORKER_FILE_LISTS = re.compile(r'const (?:VERSIONED_FILES|FIXED_FILES) = \[(.*?)\];', re.DOTALL)
QUOTED_PATH = re.compile(r"'([^']+)'")


def stop(problems):
    sys.exit('Release stopped:\n' + '\n'.join(f'  - {problem}' for problem in problems))


def version_order(version):
    """Lets versions be compared: 2026-11-17.10 comes after 2026-11-17.9."""
    date, _, counter = version.partition('.')
    return date, int(counter)


def next_version(current_version):
    today = datetime.date.today().isoformat()
    current_date, current_counter = version_order(current_version)
    if current_date == today:
        return f'{today}.{current_counter + 1}'
    return f'{today}.1'


def content_security_hash(script_text):
    digest = hashlib.sha256(script_text.encode('utf-8')).digest()
    return 'sha256-' + base64.b64encode(digest).decode('ascii')


def inline_script_hashes(index_html):
    return [content_security_hash(match.group(1)) for match in INLINE_SCRIPT.finditer(index_html)]


def update_script_hashes(index_html):
    hashes = ' '.join(f"'{script_hash}'" for script_hash in inline_script_hashes(index_html))
    updated_html, replacement_count = SCRIPT_SOURCES_IN_POLICY.subn(lambda _: f"script-src 'self' {hashes}", index_html)
    if replacement_count != 1:
        stop(["could not find exactly one \"script-src 'self'\" in the security policy in index.html"])
    return updated_html


def changelog_heading(version):
    date = datetime.date.fromisoformat(version_order(version)[0])
    return f'## {date.day} {date.strftime("%B %Y")}'  # for example "## 17 November 2026"


def find_problems(index_html, service_worker, changelog):
    problems = []

    page_versions = set(VERSION_IN_URL.findall(index_html))
    worker_versions = VERSION_IN_WORKER.findall(service_worker)
    if len(page_versions) != 1:
        problems.append(f'index.html uses {len(page_versions)} different versions: {sorted(page_versions)}')
    if len(worker_versions) != 1 or set(worker_versions) != page_versions:
        problems.append(f'service-worker.js RELEASE {worker_versions} does not match index.html {sorted(page_versions)}')

    policy = SCRIPT_SOURCES_IN_POLICY.search(index_html)
    allowed_hashes = POLICY_HASH.findall(policy.group(0)) if policy else []
    if sorted(allowed_hashes) != sorted(inline_script_hashes(index_html)):
        problems.append('the security policy hashes do not match the inline scripts; run the release without --check')

    import_map_modules = set(IMPORT_MAP_ENTRY.findall(index_html))
    worker_files = {path for listing in WORKER_FILE_LISTS.findall(service_worker) for path in QUOTED_PATH.findall(listing)}
    for module_path in sorted(MODULES_FOLDER.glob('*.js')):
        relative_path = f'js/{module_path.name}'
        if module_path.name != ENTRY_MODULE and relative_path not in import_map_modules:
            problems.append(f'{relative_path} is missing from the import map in index.html')
        if relative_path not in worker_files:
            problems.append(f'{relative_path} is missing from VERSIONED_FILES in service-worker.js')
    for listed_path in sorted(import_map_modules | worker_files):
        if listed_path != './' and not (PROJECT_ROOT / listed_path).is_file():
            problems.append(f'{listed_path} is listed but does not exist')

    if len(page_versions) == 1:
        heading = changelog_heading(next(iter(page_versions)))
        if heading not in changelog:
            problems.append(f'CHANGELOG.md has no "{heading}" entry')
    return problems


def read_project_files():
    return (INDEX_FILE.read_text(encoding='utf-8'),
            SERVICE_WORKER_FILE.read_text(encoding='utf-8'),
            CHANGELOG_FILE.read_text(encoding='utf-8'))


def check():
    problems = find_problems(*read_project_files())
    if problems:
        stop(problems)
    print('Release check passed.')


def release(requested_version):
    index_html, service_worker, changelog = read_project_files()
    current_match = VERSION_IN_URL.search(index_html)
    if not current_match:
        stop(['no ?v=<version> found in index.html'])
    current_version = current_match.group(1)

    new_version = requested_version or next_version(current_version)
    if not re.fullmatch(VERSION_PATTERN, new_version):
        stop([f'"{new_version}" is not a version like 2026-11-17.1'])
    if version_order(new_version) <= version_order(current_version):
        stop([f'{new_version} is not newer than the current release {current_version}'])

    index_html, url_count = VERSION_IN_URL.subn(f'?v={new_version}', index_html)
    service_worker, worker_count = VERSION_IN_WORKER.subn(f"const RELEASE = '{new_version}';", service_worker)
    if worker_count != 1:
        stop(["could not find \"const RELEASE = '...';\" in service-worker.js"])
    # Hashes are calculated after the version change, because the import map contains the version.
    index_html = update_script_hashes(index_html)

    INDEX_FILE.write_text(index_html, encoding='utf-8')
    SERVICE_WORKER_FILE.write_text(service_worker, encoding='utf-8')
    print(f'Release {new_version}: updated {url_count} file URLs, the service worker and the security policy hashes.')

    problems = find_problems(index_html, service_worker, changelog)
    if problems:
        print('Fix these before you push:\n' + '\n'.join(f'  - {problem}' for problem in problems))


if __name__ == '__main__':
    argument = sys.argv[1] if len(sys.argv) > 1 else None
    if argument == '--check':
        check()
    else:
        release(argument)
