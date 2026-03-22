# Azure DevOps Setup Guide

## Service Connections

### npm-connection (Mevcut)
- Type: npm
- Registry URL: https://registry.npmjs.org
- Username: oaslananka
- İsim: npm-connection

### github-mirror (Yeni Oluşturulacak)
1. Project Settings → Service connections → New service connection
2. GitHub → Personal Access Token
3. Token gereksinimleri: `repo`, `write:packages`
4. İsim: github-connection

## Variable Groups

### github-mirror-secrets
1. Pipelines → Library → Variable groups → New variable group
2. İsim: `github-mirror-secrets`
3. Variables:
   - `GITHUB_MIRROR_TOKEN` (secret): GitHub PAT token
     (Permissions: repo:all, write:packages)

### npm-publish-secrets
1. Pipelines → Library → Variable groups → New variable group
2. İsim: `npm-publish-secrets`
3. Variables:
   - `NPM_TOKEN` (secret): npmjs.com Access Token
     (Type: Automation, Permissions: Read and Publish)

## Pipeline Kurulumu

1. Pipelines → New pipeline
2. Azure Repos Git → mcp-ssh-tool
3. Existing Azure Pipelines YAML
4. CI: `.azure/pipelines/ci.yml`
5. Publish: `.azure/pipelines/publish.yml`
6. Mirror: `.azure/pipelines/mirror.yml`

## Environment Kurulumu (publish.yml için)

1. Pipelines → Environments → New environment
2. İsim: `npm-production`
3. Approvals: Add approval with owner = oaslananka
