# Bake is installed from its GitHub repository while it changes often.
# BAKE_REF chooses the branch, tag or commit, for example: make bake BAKE_REF=claude/some-branch
BAKE_REF ?= main

.PHONY: install bake dev build preview test

node_modules: package.json package-lock.json
	npm install
	@touch node_modules

install: node_modules

# Installs the latest commit of BAKE_REF and records it in package-lock.json.
bake:
	npm install --save-dev "github:yhnocoder/bake#$(BAKE_REF)"

dev: node_modules
	npx bake dev

build: node_modules
	npx bake build

preview: node_modules
	npx bake preview

test: node_modules
	npm test
