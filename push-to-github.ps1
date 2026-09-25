#!/usr/bin/env pwsh
# ============================================================
# push-to-github.ps1
# Push script for Tiny Decision
# ============================================================

$USERNAME = "aryanthegamedev3465-collab"
$REPO_NAME = "tiny-decision"

Write-Host "=== Tiny Decision GitHub Push Script ===" -ForegroundColor Cyan
git push -u origin main
