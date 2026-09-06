# Security Policy

## Reporting a vulnerability

Report security issues privately through GitHub's vulnerability reporting form:
https://github.com/ww-w-ai/super-token-saver/security/advisories/new

Do not open a public issue for a security problem. A public report describes the attack before
a fix exists.

Include what you found, the file or hook involved, and how to reproduce it. You will get a first
reply within 7 days.

## Supported versions

Only the latest release on `main` receives security fixes. Update with `/plugin` in Claude Code or
by reinstalling from the marketplace.

## Scope

super-token-saver runs locally. It reads Claude Code and Codex transcript files and the plugin's
own cache under `~/.claude/super-token-saver-data/`. The scripts and hooks make no network
requests. The only outbound access is the `/usage-view` and `/report-limit` skills asking Claude
Code to fetch Anthropic's public pricing page when a model is missing from `model-pricing.json`.
Reports about data leaving the machine, hook commands executing unexpected input, or secrets
written to the cache are in scope.
