function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function validateInventory(inventory) {
  if (!inventory || !inventory.copy
      || !Array.isArray(inventory.dictionaryRecords) || !Array.isArray(inventory.records)
      || !Array.isArray(inventory.variables)) {
    throw new Error("The JSON must contain copy, variables, dictionaryRecords, and records.");
  }

  const { copy } = inventory;
  if (typeof copy.titleLead !== "string"
      || typeof copy.titleEmphasis !== "string"
      || typeof copy.intro !== "string"
      || typeof copy.scopeTitle !== "string"
      || typeof copy.scopeSummary !== "string"
      || typeof copy.aboutHeading !== "string"
      || typeof copy.footer !== "string"
      || typeof copy.noDictionaryMatch !== "string"
      || typeof copy.noSourceLinks !== "string"
      || !Array.isArray(copy.aboutParagraphs)
      || !copy.aboutParagraphs.every(paragraph => typeof paragraph === "string")) {
    throw new Error("The JSON page copy is missing required fields.");
  }

  const dictionaryIds = new Set(inventory.dictionaryRecords.map(record => record.id));
  if (dictionaryIds.size !== inventory.dictionaryRecords.length
      || inventory.dictionaryRecords.some(record => !record.id || !record.name || !record.description
        || !Array.isArray(record.sources))) {
    throw new Error("Dictionary reference ids must be unique.");
  }
  const variableCodes = new Set(inventory.variables.map(variable => variable.code));
  const familyIds = new Set();
  for (const record of inventory.records) {
    if (!record.id || familyIds.has(record.id)
        || !record.name || !record.provider || !record.topic
        || !record.description || !record.pipeline || !record.scope
        || !record.qualification || !record.vintage || !record.formats
        || !Array.isArray(record.dictionaryIds) || !Array.isArray(record.variables)
        || !Array.isArray(record.sources)) {
      throw new Error("Each record needs a unique id and the required inventory fields.");
    }
    familyIds.add(record.id);
    for (const code of record.variables) {
      if (!variableCodes.has(code)) throw new Error(`Unknown pipeline variable: ${code}`);
    }
    for (const id of record.dictionaryIds) {
      if (!dictionaryIds.has(id)) throw new Error(`Unknown dictionary reference: ${id}`);
    }
    for (const source of record.sources) {
      if (!source.label || !source.url || !source.url.startsWith("https://")) {
        throw new Error(`Invalid source link in ${record.id}.`);
      }
    }
  }
  for (const record of inventory.dictionaryRecords) {
    for (const source of record.sources) {
      if (!source.label || !source.url || !source.url.startsWith("https://")) {
        throw new Error(`Invalid dictionary source link in ${record.id}.`);
      }
    }
  }
}

function populateFilter(select, values, records, field) {
  [...new Set(values)].sort((a, b) => a.localeCompare(b)).forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} (${records.filter(record => record[field] === value).length})`;
    option.title = value;
    select.append(option);
  });
}

function enhanceSelect(select) {
  const wrap = document.createElement("div");
  wrap.className = "cs";
  wrap.id = `${select.id}-cs`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cs-btn";
  button.id = `${select.id}-btn`;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const label = document.createElement("span");
  label.className = "cs-label";
  button.append(label);
  const list = document.createElement("ul");
  list.className = "cs-list";
  list.setAttribute("role", "listbox");
  list.id = `${select.id}-list`;
  list.hidden = true;
  button.setAttribute("aria-controls", list.id);
  select.classList.add("cs-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.after(wrap);
  wrap.append(button, list);
  const outer = document.querySelector(`label[for="${select.id}"]`);
  if (outer) outer.setAttribute("for", button.id);
  else button.setAttribute("aria-label", select.getAttribute("aria-label") || "Select");
  let active = -1;

  const items = () => [...list.children];
  function setActive(index, scroll = true) {
    items().forEach((item, i) => item.classList.toggle("is-active", i === index));
    active = index;
    const item = items()[index];
    if (item) {
      button.setAttribute("aria-activedescendant", item.id);
      if (scroll) item.scrollIntoView({ block: "nearest" });
    }
  }
  function refresh() {
    label.textContent = select.selectedOptions[0] ? select.selectedOptions[0].textContent : "";
    list.innerHTML = "";
    [...select.options].forEach((option, i) => {
      const li = document.createElement("li");
      li.id = `${list.id}-${i}`;
      li.setAttribute("role", "option");
      li.dataset.value = option.value;
      li.textContent = option.textContent;
      if (option.selected) { li.setAttribute("aria-selected", "true"); li.classList.add("is-selected"); }
      list.append(li);
    });
  }
  function open() {
    document.querySelectorAll(".cs-btn[aria-expanded=true]").forEach(other => other !== button && other.click());
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    wrap.classList.add("open");
    setActive(Math.max(select.selectedIndex, 0));
  }
  function close() {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-activedescendant");
    wrap.classList.remove("open");
  }
  function choose(index) {
    select.selectedIndex = index;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    refresh();
    close();
    button.focus();
  }
  button.addEventListener("click", () => (list.hidden ? open() : close()));
  list.addEventListener("click", event => {
    const li = event.target.closest("[role=option]");
    if (li) choose(items().indexOf(li));
  });
  button.addEventListener("keydown", event => {
    const n = select.options.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) open();
      else setActive((active + (event.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (event.key === "Home" || event.key === "End") {
      if (!list.hidden) { event.preventDefault(); setActive(event.key === "Home" ? 0 : n - 1); }
    } else if ((event.key === "Enter" || event.key === " ") && !list.hidden) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape" && !list.hidden) {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  });
  document.addEventListener("click", event => { if (!wrap.contains(event.target)) close(); });
  new MutationObserver(refresh).observe(select, { childList: true });
  refresh();
  return refresh;
}

function renderInventory(inventory) {
  const { copy, variables, dictionaryRecords, records } = inventory;
  const customSelects = [];
  const syncSelects = () => customSelects.forEach(refresh => refresh());
  const variableByCode = new Map(variables.map(variable => [variable.code, variable]));
  const dictionaryById = new Map(dictionaryRecords.map(record => [record.id, record]));
  const cards = document.querySelector("#cards");
  const useFilter = document.querySelector("#use-filter");
  const topicFilter = document.querySelector("#topic-filter");
  const providerFilter = document.querySelector("#provider-filter");
  const searchInput = document.querySelector("#search-input");
  const sortSelect = document.querySelector("#sort-select");
  const categoryCards = document.querySelector("#category-cards");

  function dictionaryMatches(record) {
    return record.dictionaryIds.map(id => dictionaryById.get(id));
  }

  function detailMarkup(record) {
    const sourceLinks = record.sources.map(({ label, url }) =>
      `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} ↗</a>`
    ).join("");
    const matches = dictionaryMatches(record);
    const info = record.productInfo;
    const chips = items => `<div class="field-chips">${items.map(item => `<code>${escapeHTML(item)}</code>`).join("")}</div>`;
    const section = (title, body) => `<section><h4>${title}</h4>${body}</section>`;
    const left = [
      section("Purpose and use", `<p>${escapeHTML(record.pipeline)}</p>`),
      section("Coverage", `<p>${escapeHTML(record.scope)}</p>`),
      info && info.builtFrom.length ? section("Built from", `<ul class="built-from">${info.builtFrom.map(name => `<li>${escapeHTML(name)}</li>`).join("")}</ul>`) : "",
      matches.length ? section("Workbook reference", `<p>${escapeHTML(matches.map(match => `${match.name}: ${match.description}`).join(" "))}</p>`) : ""
    ].join("");
    const facts = info ? [["Files", info.files.toLocaleString("en-US")], ["Size", info.size], info.rows ? ["Rows", info.rows.toLocaleString("en-US")] : null, ["Stage status", info.status.charAt(0).toUpperCase() + info.status.slice(1)]]
      .filter(Boolean).map(([label, value]) => `<dt>${label}</dt><dd>${escapeHTML(String(value))}</dd>`).join("") : "";
    const right = info
      ? [
        section("Data facts", `<dl class="detail-facts">${facts}</dl>`),
        info.keyFields.length ? section("Key fields", chips(info.keyFields)) : "",
        section("Storage", `<p><span class="badge-internal"><svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6a3 3 0 016 0v3"/></svg>Internal</span> ${escapeHTML(record.storageNote)}</p>`)
      ].join("")
      : [
        section("Data notes", `<p>${escapeHTML(record.qualification)}</p>`),
        section(record.storageNote ? "Storage" : "Documentation and sources", `<div class="sources">${sourceLinks || `<p>${escapeHTML(record.storageNote || copy.noSourceLinks)}</p>`}</div>`)
      ].join("");
    return `<div class="details" id="details-${escapeHTML(record.id)}" hidden>
      <div class="details-col">${left}</div>
      <div class="details-col">${right}</div>
      <div class="details-end"><button class="detail-close" type="button" aria-controls="details-${escapeHTML(record.id)}">Hide details −</button></div>
    </div>`;
  }

  function cardMarkup(record) {
    const chip = (code, name, definition, extra = "") => `<span class="use-chip${extra}" data-code="${escapeHTML(code)}" title="${escapeHTML(definition)}"><b>${escapeHTML(code)}</b>${escapeHTML(name)}</span>`;
    const usedFor = record.variables.length
      ? record.variables.map(code => chip(code, variableByCode.get(code).name, variableByCode.get(code).definition)).join("")
      : (record.supportingUse || []).map(u => chip(u.code, u.name, u.definition, " supporting")).join("")
        || '<span class="use-chip reference">Not yet assigned</span>';
    const accent = [...new Set(records.map(item => item.topic))].sort((a, b) => a.localeCompare(b)).indexOf(record.topic) % 6;
    return `<article class="card" data-accent="${accent}">
      <div class="tags"><span class="tag">${escapeHTML(record.topic)}</span></div>
      <h3>${escapeHTML(record.name)}</h3>
      <p class="provider"><span class="provider-label">Provider</span>${escapeHTML(record.provider)}</p>
      <p class="description">${escapeHTML(record.description)}</p>
      <div class="used-for"><span class="used-label">Used for</span><div class="use-chips">${usedFor}</div></div>
      <dl class="facts">
        <div><dt>Data vintage</dt><dd>${escapeHTML(record.vintage)}</dd></div>
        <div><dt>Data format</dt><dd>${escapeHTML(record.formats)}</dd></div>
      </dl>
      <div class="card-footer">
        <button class="detail-toggle" type="button" aria-expanded="false" aria-controls="details-${escapeHTML(record.id)}">View details +</button>
      </div>
      ${detailMarkup(record)}
    </article>`;
  }

  function renderCategoryCards() {
    const topics = [...new Set(records.map(record => record.topic))].sort((a, b) => a.localeCompare(b));
    categoryCards.innerHTML = topics.map((topic, index) => {
      const count = records.filter(record => record.topic === topic).length;
      const active = topicFilter.value === topic;
      return `<button class="category-card" type="button" data-topic="${escapeHTML(topic)}" aria-pressed="${active}" aria-label="Filter by ${escapeHTML(topic)}, ${count} datasets">
        <span class="category-card-top"><span class="category-index">${index + 1}</span><span class="category-count">${count} ${count === 1 ? "dataset" : "datasets"}</span></span>
        <strong>${escapeHTML(topic)}</strong><span class="category-action">${active ? "Selected · click to clear ✕" : "Show datasets →"}</span>
      </button>`;
    }).join("");
  }

  function filteredRecords() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    return records.filter(record => {
      const dictionaryText = dictionaryMatches(record).map(match =>
        [match.name, match.description, match.sourceNote, match.keywords].join(" ")
      );
      const text = `${JSON.stringify(record)} ${dictionaryText.join(" ")}`.toLocaleLowerCase();
      return (!useFilter.value || (useFilter.value === "none" ? !record.variables.length : record.variables.includes(useFilter.value)))
        && (!topicFilter.value || record.topic === topicFilter.value)
        && (!providerFilter.value || record.provider === providerFilter.value)
        && (!query || text.includes(query));
    }).sort((a, b) => {
      const field = sortSelect.value;
      return a[field].localeCompare(b[field]) || a.name.localeCompare(b.name);
    });
  }

  function activeFilters() {
    const chips = [];
    if (useFilter.value) chips.push({ label: useFilter.selectedOptions[0].textContent.replace(/ \(\d+\)$/, ""), clear: () => { useFilter.value = ""; } });
    if (topicFilter.value) chips.push({ label: topicFilter.value, clear: () => { topicFilter.value = ""; } });
    if (providerFilter.value) chips.push({ label: providerFilter.value, clear: () => { providerFilter.value = ""; } });
    if (searchInput.value.trim()) chips.push({ label: `Search: “${searchInput.value.trim()}”`, clear: () => { searchInput.value = ""; } });
    return chips;
  }

  function renderActiveFilters() {
    const chips = activeFilters();
    const box = document.querySelector("#active-filters");
    box.innerHTML = chips.map((chip, i) =>
      `<span class="filter-chip">${escapeHTML(chip.label)}<button type="button" data-chip="${i}" aria-label="Remove filter: ${escapeHTML(chip.label)}">✕</button></span>`).join("");
    box.onclick = event => {
      const button = event.target.closest("[data-chip]");
      if (!button) return;
      chips[Number(button.dataset.chip)].clear();
      render();
    };
    const clearButton = document.querySelector("#clear-filters");
    clearButton.disabled = !chips.length;
    clearButton.textContent = chips.length ? `Clear filters (${chips.length})` : "Clear filters";
    const badge = document.querySelector("#filter-badge");
    badge.hidden = !chips.length;
    badge.textContent = chips.length;
  }

  function render() {
    const visible = filteredRecords();
    renderActiveFilters();
    renderCategoryCards();
    syncSelects();
    cards.innerHTML = visible.length
      ? visible.map(cardMarkup).join("")
      : '<div class="empty"><p>No matching records. Try another search or clear the filters.</p><button class="btn primary" type="button" id="empty-clear">Clear filters</button></div>';
    const filtered = visible.length !== records.length;
    document.querySelector("#result-count").innerHTML = filtered
      ? `Showing <strong>${formatCount(visible.length)}</strong> of <strong>${formatCount(records.length)}</strong> datasets`
      : `<strong>${formatCount(records.length)}</strong> datasets`;
    document.querySelector("#export-csv").innerHTML = `<span aria-hidden="true">⤓</span> Download CSV${filtered ? ` (${formatCount(visible.length)})` : ""}`;
  }

  function downloadCSV() {
    const fields = ["name", "provider", "variables", "topic", "formats", "vintage", "description", "pipeline", "scope", "qualification", "dictionaryMatches", "sources"];
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [fields, ...filteredRecords().map(record => fields.map(field =>
      field === "variables" ? record.variables.map(code => `${code} (${variableByCode.get(code).name})`).join("; ")
        : field === "dictionaryMatches" ? dictionaryMatches(record).map(match => match.name).join("; ")
        : field === "sources" ? record.sources.map(source => `${source.label}: ${source.url}`).join("; ")
          : record[field]
    ))];
    const csv = rows.map(row => row.map(quote).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "fire-risk-data-catalog.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  document.querySelector("#title-lead").textContent = copy.titleLead;
  document.querySelector("#title-emphasis").textContent = copy.titleEmphasis;
  document.querySelector("#page-intro").textContent = copy.intro;
  document.querySelector("#scope-title").textContent = copy.scopeTitle;
  document.querySelector("#scope-summary").textContent = copy.scopeSummary;
  const providerCount = new Set(records.map(record => record.provider)).size;
  const topicCount = new Set(records.map(record => record.topic)).size;
  document.querySelector("#family-count").textContent = formatCount(records.length);
  document.querySelector("#provider-count").textContent = formatCount(providerCount);
  document.querySelector("#topic-count").textContent = formatCount(topicCount);
  document.querySelector("#data-size").textContent = copy.totalDataSize || "~528 GB";
  document.querySelector("#data-size-note").textContent = copy.totalDataNote || "";
  document.querySelector("#about-title").textContent = copy.aboutHeading;
  const aboutCopy = document.querySelector("#about-copy");
  const aboutList = document.createElement("ul");
  copy.aboutParagraphs.forEach(text => {
    const item = document.createElement("li");
    item.textContent = text;
    aboutList.append(item);
  });
  const issueItem = document.createElement("li");
  issueItem.append("To suggest a correction, ");
  const issueLink = document.createElement("a");
  issueLink.href = "https://github.com/ulfsri/fire-risk-data-inventory/issues";
  issueLink.target = "_blank";
  issueLink.rel = "noopener noreferrer";
  issueLink.textContent = "open a GitHub issue ↗";
  issueItem.append(issueLink, " with the record name, the text to change and a link to the provider\u2019s documentation.");
  aboutList.append(issueItem);
  aboutCopy.append(aboutList);
  const varRows = inventory.productVariables || [];
  const varBody = document.querySelector("#variable-rows");
  const varSearch = document.querySelector("#variable-search");
  const varGroupBox = document.querySelector("#variable-groups");
  const varCodes = { ann_freq: "X", Lp: "Lp", Lc: "Lc", Eb: "Eb", Ep: "Ep", WEI: "WEI", CRF: "CRF" };
  const varGroups = [...new Set(varRows.map(row => row.group))];
  let activeVarGroup = "";
  const inlineCode = text => escapeHTML(text).replace(/`([^`]+)`/g, "<code>$1</code>");
  const highlight = (html, query) => query
    ? html.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![^<]*>)`, "gi"), "<mark>$1</mark>")
    : html;
  document.querySelector("#variables-intro").textContent = `${varRows.length} columns in the block-group WUI risk product, grouped by calculation stage.`;

  const varGroupSelect = document.querySelector("#variable-group-select");
  function renderVariableGroups() {
    varGroupSelect.innerHTML = [["", "All groups", varRows.length], ...varGroups.map(g => [g, g, varRows.filter(r => r.group === g).length])]
      .map(([value, label, n]) => `<option value="${escapeHTML(value)}"${activeVarGroup === value ? " selected" : ""}>${escapeHTML(label)} (${n})</option>`).join("");
    varGroupBox.innerHTML = [["", "All", varRows.length], ...varGroups.map(g => [g, g, varRows.filter(r => r.group === g).length])]
      .map(([value, label, n]) => `<button type="button" data-group="${escapeHTML(value)}" aria-pressed="${activeVarGroup === value}">${escapeHTML(label)}<span>${n}</span></button>`).join("");
  }

  function renderVariables() {
    const q = varSearch.value.trim().toLocaleLowerCase();
    const rows = varRows.filter(r => (!activeVarGroup || r.group === activeVarGroup)
      && (!q || Object.values(r).join(" ").toLocaleLowerCase().includes(q)));
    let lastGroup = "";
    varBody.innerHTML = rows.map(r => {
      const header = r.group !== lastGroup ? `<tr class="var-group"><th colspan="3" scope="colgroup">${escapeHTML(r.group)}</th></tr>` : "";
      lastGroup = r.group;
      const code = varCodes[r.variable];
      const dot = code ? `<i class="var-dot" data-code="${code}" title="Pipeline variable ${code}"></i>` : "";
      return `${header}<tr><td><span class="var-name">${dot}<code>${highlight(escapeHTML(r.variable), q)}</code><button class="var-copy" type="button" data-copy="${escapeHTML(r.variable)}" aria-label="Copy ${escapeHTML(r.variable)}">Copy</button></span></td><td>${highlight(escapeHTML(r.shortName), q)}</td><td>${highlight(inlineCode(r.definition), q)}</td></tr>`;
    }).join("") || '<tr><td colspan="3">No matching variables.</td></tr>';
    document.querySelector("#variable-count").textContent = rows.length === varRows.length ? `${rows.length} variables` : `Showing ${rows.length} of ${varRows.length} variables`;
    renderVariableGroups();
    syncSelects();
  }
  varSearch.addEventListener("input", renderVariables);
  varGroupSelect.addEventListener("change", () => { activeVarGroup = varGroupSelect.value; renderVariables(); });
  varGroupBox.addEventListener("click", event => {
    const button = event.target.closest("[data-group]");
    if (!button) return;
    activeVarGroup = button.dataset.group;
    renderVariables();
  });
  varBody.addEventListener("click", async event => {
    const button = event.target.closest(".var-copy");
    if (!button) return;
    try { await navigator.clipboard.writeText(button.dataset.copy); } catch { return; }
    button.textContent = "Copied";
    button.classList.add("done");
    setTimeout(() => { button.textContent = "Copy"; button.classList.remove("done"); }, 1200);
  });
  document.querySelector("#variables-csv").addEventListener("click", () => {
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [["variable", "short_name", "group", "definition"], ...varRows.map(r => [r.variable, r.shortName, r.group, r.definition.replaceAll("`", "")])]
      .map(row => row.map(quote).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "wui-product-variables.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });
  renderVariables();

  variables.forEach(({ code, name }) => useFilter.append(new Option(`${code} · ${name} (${records.filter(r => r.variables.includes(code)).length})`, code)));
  useFilter.append(new Option(`Supporting only, no variable input (${records.filter(r => !r.variables.length).length})`, "none"));
  populateFilter(topicFilter, records.map(record => record.topic), records, "topic");
  populateFilter(providerFilter, records.map(record => record.provider), records, "provider");
  ["use-filter", "topic-filter", "provider-filter", "sort-select", "variable-group-select"].forEach(id => customSelects.push(enhanceSelect(document.getElementById(id))));
  [useFilter, topicFilter, providerFilter, sortSelect].forEach(control => control.addEventListener("change", render));
  searchInput.addEventListener("input", render);
  document.addEventListener("keydown", event => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      searchInput.focus();
      searchInput.scrollIntoView({ block: "center" });
    } else if (event.key === "Escape" && document.activeElement === searchInput && searchInput.value) {
      searchInput.value = "";
      render();
    }
  });
  document.querySelector("#clear-filters").addEventListener("click", () => {
    useFilter.value = "";
    topicFilter.value = "";
    providerFilter.value = "";
    searchInput.value = "";
    sortSelect.value = "name";
    render();
    searchInput.focus();
  });
  document.querySelector("#export-csv").addEventListener("click", downloadCSV);
  const filterToggle = document.querySelector("#filter-toggle");
  filterToggle.addEventListener("click", () => {
    const open = filterToggle.getAttribute("aria-expanded") !== "true";
    filterToggle.setAttribute("aria-expanded", String(open));
    filterToggle.firstChild.textContent = open ? "Hide filters " : "Show filters ";
    filterToggle.closest("aside").classList.toggle("open", open);
  });
  cards.addEventListener("click", event => { if (event.target.closest("#empty-clear")) document.querySelector("#clear-filters").click(); });
  categoryCards.addEventListener("click", event => {
    const button = event.target.closest(".category-card");
    if (!button) return;
    topicFilter.value = topicFilter.value === button.dataset.topic ? "" : button.dataset.topic;
    useFilter.value = "";
    providerFilter.value = "";
    searchInput.value = "";
    render();
    if (topicFilter.value) document.querySelector("#inventory").scrollIntoView({ behavior: "smooth" });
  });
  cards.addEventListener("click", event => {
    const trigger = event.target.closest(".detail-toggle, .detail-close");
    if (!trigger) return;
    const card = trigger.closest(".card");
    const button = card.querySelector(".detail-toggle");
    const details = card.querySelector(".details");
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    button.textContent = expanded ? "View details +" : "Hide details −";
    details.hidden = expanded;
    card.classList.toggle("expanded", !expanded);
    if (expanded && trigger.classList.contains("detail-close")) {
      button.focus();
      button.scrollIntoView({ block: "center" });
    }
  });
  render();
}

async function loadInventory() {
  try {
    const response = await fetch("./data/inventory.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`JSON request failed with status ${response.status}.`);
    const inventory = await response.json();
    validateInventory(inventory);
    renderInventory(inventory);
  } catch (error) {
    const message = document.querySelector("#load-error p");
    message.textContent = `The inventory data could not be loaded. Serve this page over HTTP and check data/inventory.json. ${error.message}`;
    document.querySelector("#load-error").hidden = false;
    console.error("Could not load the fire-risk inventory.", error);
  }
}

loadInventory();

const navLinks = [...document.querySelectorAll(".topbar nav a")];
const refTabs = [...document.querySelectorAll(".ref-tab")];
const targetOf = link => {
  const id = link.getAttribute("href").slice(1);
  return id === "about" || id === "variables" ? document.querySelector("#reference") : document.getElementById(id);
};
const navTargets = navLinks.map(link => ({ link, el: targetOf(link) })).filter(item => item.el);

function activateTab(name, focus = false) {
  refTabs.forEach(tab => {
    const on = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
    if (on && focus) tab.focus();
  });
  updateActiveNav();
}

function openFromHash(scroll) {
  const id = location.hash.slice(1);
  if (id !== "about" && id !== "variables") return;
  activateTab(id);
  if (scroll) document.querySelector("#reference").scrollIntoView({ behavior: "smooth" });
}

refTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
    history.replaceState(null, "", `#${tab.dataset.tab}`);
  });
  tab.addEventListener("keydown", event => {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      activateTab(refTabs[event.key === "Home" ? 0 : refTabs.length - 1].dataset.tab, true);
    } else if (move) {
      event.preventDefault();
      activateTab(refTabs[(index + move + refTabs.length) % refTabs.length].dataset.tab, true);
    }
  });
});

navLinks.forEach(link => link.addEventListener("click", () => {
  const id = link.getAttribute("href").slice(1);
  if (id === "about" || id === "variables") setTimeout(() => openFromHash(true), 0);
}));
window.addEventListener("hashchange", () => openFromHash(true));

function updateActiveNav() {
  const line = window.scrollY + 140;
  let current = null;
  navTargets.forEach(({ link, el }) => {
    const id = link.getAttribute("href").slice(1);
    const isRef = el.id === "reference";
    if (isRef && id !== document.querySelector(".ref-tab[aria-selected=true]").dataset.tab) return;
    if (el.offsetTop <= line) current = id;
  });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
    current = document.querySelector(".ref-tab[aria-selected=true]").dataset.tab;
  }
  navLinks.forEach(link => {
    if (link.getAttribute("href") === `#${current}`) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}
window.addEventListener("scroll", updateActiveNav, { passive: true });
window.addEventListener("load", () => { openFromHash(false); updateActiveNav(); });

const toTop = document.querySelector("#to-top");
window.addEventListener("scroll", () => { toTop.hidden = window.scrollY < 900 || window.innerWidth > 850; }, { passive: true });
toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
