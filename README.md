# EO-VLM Website

This directory contains the static GitHub Pages site for the EO-VLM benchmark.

## Content Model

The page template is defined in `index.html`. Benchmark context, imagery placeholders, and page copy stay in the main page, while benchmark outputs are loaded at runtime from model-specific manifest files under `data/`.

Current examples:

- `data/qwen/manifest.json`
- `data/lfm/manifest.json`

Each manifest can describe one model, its summary score, and its task-level metrics. To add another model, create `data/<model>/manifest.json` and register that path in `static/js/index.js`.

## Local Preview

Because the page uses `fetch()` to load local manifest files, preview it through an HTTP server rather than opening `index.html` directly with `file://`.
