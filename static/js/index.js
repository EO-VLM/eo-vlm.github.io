const RESULT_MANIFESTS = [
  './data/internvl2_8b/single/manifest.json',
  './data/lfm2_5_vl_450m/single/manifest.json',
  './data/llava_1.5_7b/single/manifest.json',
  './data/llava_1.6_7b/single/manifest.json',
  './data/llava-onevision-7b/single/manifest.json',
  './data/qwen2_vl_7b_instruct/single/manifest.json'
];

const COLUMN_KEYS = {
  model: 'modelSlug',
  all: 'all',
  dataset: 'datasetName',
  emphasis: 'emphasis',
  geobench: 'geobenchVlm'
};

const TABLE_IDS = {
  leaderboard: 'leaderboard',
  geobench: 'geobench-vlm'
};

const RESULTS_INTERACTIONS_BOUND_ATTR = 'data-results-interactions-bound';

const LEADERBOARD_DATASETS = [
  { key: COLUMN_KEYS.geobench, label: 'GeoBench-VLM' }
];

const TABLE_SORT_STATE = {};
const TABLE_REGISTRY = new Map();

document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});

async function loadResults() {
  const results = await Promise.allSettled(RESULT_MANIFESTS.map((path) => fetchJson(path)));
  const manifests = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  if (!manifests.length) {
    const firstFailure = results.find((result) => result.status === 'rejected');
    renderError('results-content', 'Benchmark manifests could not be loaded.', firstFailure ? firstFailure.reason : 'No manifest files configured.');
    return;
  }

  renderManifestResults(manifests);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function renderManifestResults(manifests) {
  const container = document.getElementById('results-content');
  const detailRows = manifests.map((manifest) => normalizeManifest(manifest));
  const metricColumns = collectMetricColumns(detailRows);
  const sharedPrefixColumns = [
    { key: COLUMN_KEYS.model, label: 'Model' },
    { key: COLUMN_KEYS.all, label: 'ALL' }
  ];
  const leaderboardColumns = [
    ...sharedPrefixColumns,
    ...LEADERBOARD_DATASETS.map((dataset) => ({
      key: dataset.key,
      label: dataset.label
    }))
  ];
  const leaderboardRows = detailRows.map((row) => ({
    [COLUMN_KEYS.model]: row[COLUMN_KEYS.model],
    [COLUMN_KEYS.all]: row[COLUMN_KEYS.all],
    [COLUMN_KEYS.geobench]: row[COLUMN_KEYS.geobench]
  }));
  const tables = [
    {
      id: TABLE_IDS.leaderboard,
      title: 'Leaderboard',
      note: 'Comparison of vision-language models evaluated across benchmark aggregates, ranked by overall performance.',
      columns: leaderboardColumns,
      rows: leaderboardRows,
      defaultSortKey: COLUMN_KEYS.all,
      defaultSortDirection: 'desc'
    },
    {
      id: TABLE_IDS.geobench,
      title: 'GeoBench-VLM',
      noteHtml: 'GeoBench-VLM is an Earth observation benchmark for evaluating vision-language models on satellite and aerial imagery across diverse perception and reasoning tasks. <a href="https://huggingface.co/datasets/aialliance/GEOBench-VLM" target="_blank" rel="noreferrer">Dataset</a>.',
      columns: [...sharedPrefixColumns, ...metricColumns],
      rows: detailRows,
      defaultSortKey: COLUMN_KEYS.all,
      defaultSortDirection: 'desc'
    }
  ];

  TABLE_REGISTRY.clear();
  tables.forEach((table) => {
    TABLE_REGISTRY.set(table.id, table);

    if (!TABLE_SORT_STATE[table.id]) {
      TABLE_SORT_STATE[table.id] = {
        sortKey: table.defaultSortKey,
        sortDirection: table.defaultSortDirection
      };
    }
  });

  container.className = 'content has-text-justified';
  container.innerHTML = `
    <div class="results-stack">
      ${tables.map((table) => renderTableCard(table)).join('')}
    </div>
  `;

  bindResultsInteractions(container);
}

function normalizeManifest(manifest) {
  const scores = manifest && manifest.scores ? manifest.scores : {};
  const perTaskScores = scores.per_task && typeof scores.per_task === 'object' ? scores.per_task : {};
  const overallScore = formatScore(scores.overall);
  const row = {
    [COLUMN_KEYS.model]: manifest && (manifest.name || manifest.model_slug) ? manifest.name || manifest.model_slug : 'unknown_model',
    [COLUMN_KEYS.dataset]: manifest && manifest.split ? manifest.split : 'data',
    [COLUMN_KEYS.all]: overallScore,
    [COLUMN_KEYS.geobench]: overallScore
  };

  Object.entries(perTaskScores).forEach(([taskName, score]) => {
    row[taskName] = formatScore(score);
  });

  return row;
}

function collectMetricColumns(rows) {
  const keys = new Set();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (![COLUMN_KEYS.model, COLUMN_KEYS.all, COLUMN_KEYS.emphasis, COLUMN_KEYS.dataset, COLUMN_KEYS.geobench].includes(key)) {
        keys.add(key);
      }
    });
  });

  return Array.from(keys).sort().map((key) => ({
    key,
    label: key
  }));
}

function renderTableCard(table) {
  return `
    <section class="results-section">
      <div class="results-card-header">
        <h3 class="title is-4">${escapeHtml(table.title || '')}</h3>
        ${renderTableNote(table)}
      </div>
      <article class="results-card" data-table-id="${escapeAttribute(table.id)}">
        ${renderTableCardContent(table)}
      </article>
    </section>
  `;
}

function renderTableCardContent(table) {
  const state = TABLE_SORT_STATE[table.id] || {
    sortKey: table.defaultSortKey,
    sortDirection: table.defaultSortDirection
  };
  const sortedRows = sortRows(table.rows, state.sortKey, state.sortDirection);

  return `
    <div class="table-container benchmark-table-wrapper">
      <table class="table is-fullwidth is-hoverable benchmark-table">
        <thead>
          <tr>${table.columns.map((column) => renderHeaderCell(column, state)).join('')}</tr>
        </thead>
        <tbody>
          ${sortedRows.map((row, index) => renderRow(row, table.columns, index)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTableNote(table) {
  if (table.noteHtml) {
    return `<p class="results-note">${table.noteHtml}</p>`;
  }

  if (table.note) {
    return `<p class="results-note">${escapeHtml(table.note)}</p>`;
  }

  return '';
}

function renderHeaderCell(column, state) {
  const label = escapeHtml(column.label || column.key || '');
  const className = column.className ? ` ${escapeAttribute(column.className)}` : '';

  if (column.sortable === false) {
    return `<th class="${`static-header${className}`.trim()}"><span class="table-heading-label">${label}</span></th>`;
  }

  const isActive = state.sortKey === column.key;
  const direction = isActive ? state.sortDirection : '';
  const indicator = isActive ? (direction === 'desc' ? '↓' : '↑') : '↕';

  return `
    <th class="${`sortable-header${isActive ? ' is-active' : ''}${className}`.trim()}">
      <button type="button" class="sort-button" data-sort-key="${escapeAttribute(column.key)}" aria-label="Sort by ${escapeAttribute(column.label || column.key || '')}">
        <span class="table-heading-label">${label}</span>
        <span class="sort-indicator" aria-hidden="true">${indicator}</span>
      </button>
    </th>
  `;
}

function renderRow(row, columns, rowIndex) {
  const classes = [];

  if (row[COLUMN_KEYS.emphasis]) {
    classes.push(`row-${escapeAttribute(row[COLUMN_KEYS.emphasis])}`);
  }

  const rowClass = classes.length ? ` class="${classes.join(' ')}"` : '';

  return `<tr${rowClass}>${columns.map((column) => renderCell(column, row, rowIndex)).join('')}</tr>`;
}

function renderCell(column, row, rowIndex) {
  const cellData = row[column.key];

  if (cellData && typeof cellData === 'object' && !Array.isArray(cellData)) {
    const tone = cellData.tone ? ` metric-${escapeAttribute(cellData.tone)}` : '';
    return `<td class="${`metric-cell${tone}`.trim()}">${escapeHtml(cellData.value || '')}</td>`;
  }

  return `<td>${escapeHtml(cellData == null ? '' : String(cellData))}</td>`;
}

function bindResultsInteractions(container) {
  if (container.hasAttribute(RESULTS_INTERACTIONS_BOUND_ATTR)) {
    return;
  }

  container.addEventListener('click', (event) => {
    const button = event.target.closest('.sort-button');

    if (!button) {
      return;
    }

    const card = button.closest('[data-table-id]');

    if (!card) {
      return;
    }

    const tableId = card.getAttribute('data-table-id');
    const table = TABLE_REGISTRY.get(tableId);
    const sortKey = button.getAttribute('data-sort-key');

    if (!table || !sortKey) {
      return;
    }

    const currentState = TABLE_SORT_STATE[tableId] || {
      sortKey: table.defaultSortKey,
      sortDirection: table.defaultSortDirection
    };

    TABLE_SORT_STATE[tableId] = {
      sortKey,
      sortDirection: getNextSortDirection(sortKey, currentState)
    };

    card.innerHTML = renderTableCardContent(table);
  });

  container.setAttribute(RESULTS_INTERACTIONS_BOUND_ATTR, 'true');
}

function sortRows(rows, sortKey, sortDirection) {
  const directionFactor = sortDirection === 'asc' ? 1 : -1;

  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = left.row[sortKey];
      const rightValue = right.row[sortKey];

      if (sortKey === COLUMN_KEYS.model) {
        const modelComparison = compareText(leftValue, rightValue) * directionFactor;

        if (modelComparison !== 0) {
          return modelComparison;
        }

        return left.index - right.index;
      }

      const leftNumber = toNumber(leftValue);
      const rightNumber = toNumber(rightValue);
      const leftIsFinite = Number.isFinite(leftNumber);
      const rightIsFinite = Number.isFinite(rightNumber);

      if (leftIsFinite && !rightIsFinite) {
        return -1;
      }

      if (!leftIsFinite && rightIsFinite) {
        return 1;
      }

      if (leftIsFinite && rightIsFinite && leftNumber !== rightNumber) {
        return (leftNumber - rightNumber) * directionFactor;
      }

      const modelComparison = compareText(left.row[COLUMN_KEYS.model], right.row[COLUMN_KEYS.model]);

      if (modelComparison !== 0) {
        return modelComparison;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.row);
}

function getNextSortDirection(sortKey, currentState) {
  if (currentState.sortKey === sortKey) {
    return currentState.sortDirection === 'desc' ? 'asc' : 'desc';
  }

  return sortKey === COLUMN_KEYS.model ? 'asc' : 'desc';
}

function compareText(leftValue, rightValue) {
  return String(leftValue || '').localeCompare(String(rightValue || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function renderError(containerId, message, reason) {
  const container = document.getElementById(containerId);
  const detail = reason instanceof Error ? reason.message : String(reason || 'Unknown error');

  container.className = 'content has-text-justified error-panel';
  container.innerHTML = `
    <h2 class="title is-4">${escapeHtml(message)}</h2>
    <p>${escapeHtml(detail)}</p>
    <p class="error-hint">If you are previewing locally, use an HTTP server instead of opening index.html via file:// so fetch() can read the JSON files.</p>
  `;
}

function formatScore(value) {
  const numericValue = toNumber(value);

  if (!Number.isFinite(numericValue)) {
    return '--';
  }

  return numericValue.toFixed(2);
}

function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
