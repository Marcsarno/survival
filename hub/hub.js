// Renders the hub pages from window.HUB (data.js). Plain script, no build step: works from file:// and from `npm run hub`.
const H = window.HUB;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const STATUS = {
  reference: 'Reference', planned: 'Planned', implemented: 'Implemented', 'agent-tested': 'Agent-tested',
  approved: 'Approved by Marc', unverified: 'Unverified', superseded: 'Superseded',
};
const chip = (s) => s ? `<span class="chip" style="background:var(--s-${s})" title="${esc(STATUS[s])}">${esc(STATUS[s] || s)}</span>` : '';

function media(it) {
  const cap = `<figcaption>${chip(it.status)}<b>${esc(it.title || it.name || '')}</b>${it.note ? esc(it.note) : ''}${it.meta ? `<div class="mute">${esc(it.meta)}</div>` : ''}</figcaption>`;
  if (!it.file) return `<figure><div class="missing">${esc(it.missing || 'No capture yet')}</div>${cap}</figure>`;
  const miss = esc(it.missing || `Missing locally: ${it.file}`);
  if (/\.(webm|mp4)$/i.test(it.file)) {
    return `<figure><video src="${esc(it.file)}" controls loop muted playsinline preload="metadata" ${it.poster ? `poster="${esc(it.poster)}"` : ''}></video>${cap}</figure>`;
  }
  return `<figure><img loading="lazy" src="${esc(it.file)}" alt="${esc(it.title || '')}" data-cap="${esc((it.title || '') + (it.note ? ' — ' + it.note : ''))}" onerror="this.outerHTML='<div class=missing>${miss.replace(/'/g, '&#39;')}</div>'" />${cap}</figure>`;
}
const gallery = (items, wide) => `<div class="grid${wide ? ' wide' : ''}">${items.map(media).join('')}</div>`;

/** A group of related versions (e.g. baseline / slice v1 / v2) shown in one slot with version buttons. */
let vgId = 0;
function versioned(g) {
  const id = 'vg' + vgId++;
  const btns = g.versions.map((v, i) => `<button data-vg="${id}" data-i="${i}" class="${i === g.versions.length - 1 ? 'on' : ''}">${esc(v.label)}</button>`).join('');
  const last = g.versions[g.versions.length - 1];
  return `<div class="card"><h3>${esc(g.title)}</h3>${g.note ? `<p class="mute">${esc(g.note)}</p>` : ''}<div class="versions">${btns}</div><div id="${id}">${media({ ...last, title: last.label })}</div></div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-vg]');
  if (b) {
    const group = versionGroups[b.dataset.vg]; const v = group.versions[+b.dataset.i];
    document.getElementById(b.dataset.vg).innerHTML = media({ ...v, title: v.label });
    document.querySelectorAll(`[data-vg="${b.dataset.vg}"]`).forEach((x) => x.classList.toggle('on', x === b));
    return;
  }
  const img = e.target.closest('figure img');
  if (img) { const lb = $('#lightbox'); lb.querySelector('img').src = img.src; lb.querySelector('p').textContent = img.dataset.cap || ''; lb.hidden = false; return; }
  if (e.target.closest('#lightbox')) $('#lightbox').hidden = true;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#lightbox').hidden = true; });
const versionGroups = {};
function vg(g) { const html = versioned(g); versionGroups['vg' + (vgId - 1)] = g; return html; }

function table(rows, cols) {
  return `<div class="tablewrap"><table><tr>${cols.map((c) => `<th>${esc(c[1])}</th>`).join('')}</tr>${rows.map((r) => `<tr>${cols.map(([k]) => `<td>${k === 'status' ? chip(r[k]) : (r[k + 'Html'] ?? esc(r[k]))}</td>`).join('')}</tr>`).join('')}</table></div>`;
}

function routeSvg(route) {
  const pts = [...(route.planned || []), ...(route.implemented || [])];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const pad = 14, cx = (Math.min(...xs) + Math.max(...xs)) / 2, hx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2 + pad, (Math.max(...zs) - Math.min(...zs)) / 7), x0 = cx - hx, x1 = cx + hx, z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad;
  const W = 300, Hh = Math.round(W * (z1 - z0) / (x1 - x0));
  const sx = (x) => ((x - x0) / (x1 - x0)) * W, sz = (z) => ((z - z0) / (z1 - z0)) * Hh;
  const line = (p, style) => `<polyline points="${p.map(([x, z]) => `${sx(x).toFixed(1)},${sz(z).toFixed(1)}`).join(' ')}" fill="none" ${style} />`;
  let s = `<svg class="route-svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Route diagram, north at the top">`;
  s += `<rect width="${W}" height="${Hh}" fill="var(--snow)" rx="8"/>`;
  for (const sec of route.sections) if (sec.band) {
    const [za, zb] = sec.band; s += `<rect x="0" y="${sz(Math.min(za, zb))}" width="${W}" height="${Math.abs(sz(zb) - sz(za))}" fill="${sec.color}" opacity=".35"/>`;
    s += `<text x="6" y="${sz(Math.min(za, zb)) + 14}" font-size="11" fill="var(--mute)">${esc(sec.name)}</text>`;
  }
  if (route.planned) s += line(route.planned, 'stroke="#7c5cc4" stroke-width="3" stroke-dasharray="6 5" opacity=".8"');
  if (route.implemented) s += line(route.implemented, 'stroke="#2f7fc1" stroke-width="4" stroke-linejoin="round"');
  for (const m of route.markers || []) s += `<circle cx="${sx(m.x)}" cy="${sz(m.z)}" r="5" fill="${m.color || '#c9772e'}" stroke="#fff" stroke-width="1.5"/><text x="${sx(m.x) + 8}" y="${sz(m.z) + 4}" font-size="11" fill="var(--ink)">${esc(m.label)}</text>`;
  s += `<text x="${W - 30}" y="18" font-size="12" fill="var(--ink)">N ↑</text></svg>`;
  return s;
}

/** A small top-down map: several polylines (x, z in meters, north up), shaded area bands and labeled markers. */
function mapSvg(m) {
  const pts = m.lines.flatMap((l) => l.pts);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const pad = 9, x0 = Math.min(...xs) - pad - 14, x1 = Math.max(...xs) + pad + 22, z0 = Math.min(...zs) - pad, z1 = Math.max(...zs) + pad;
  const W = 360, Hh = Math.round(W * (z1 - z0) / (x1 - x0));
  const sx = (x) => ((x - x0) / (x1 - x0)) * W, sz = (z) => ((z - z0) / (z1 - z0)) * Hh;
  let s = `<svg class="route-svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(m.aria || 'Map, north at the top')}">`;
  s += `<rect width="${W}" height="${Hh}" fill="var(--snow)" rx="8"/>`;
  for (const b of m.bands || []) {
    const ya = sz(Math.min(...b.z)), yb = sz(Math.max(...b.z));
    s += `<rect x="0" y="${ya}" width="${W}" height="${yb - ya}" fill="${b.color}" opacity=".28"/><text x="5" y="${ya + 12}" font-size="10" fill="var(--mute)">${esc(b.name)}</text>`;
  }
  for (const l of m.lines) {
    const p = l.pts.map(([x, z]) => `${sx(x).toFixed(1)},${sz(z).toFixed(1)}`).join(' ');
    s += `<polyline points="${p}" fill="none" stroke="${l.color}" stroke-width="${l.width || 4}" stroke-linejoin="round" stroke-linecap="round" ${l.dash ? `stroke-dasharray="${l.dash}"` : ''}/>`;
  }
  for (const k of m.markers || []) {
    s += `<circle cx="${sx(k.x)}" cy="${sz(k.z)}" r="5" fill="${k.color || '#c9772e'}" stroke="#fff" stroke-width="1.5"/>`;
    s += `<text x="${sx(k.x) + (k.left ? -8 : 8)}" y="${sz(k.z) + 4}" font-size="11" fill="var(--ink)" text-anchor="${k.left ? 'end' : 'start'}">${esc(k.label)}</text>`;
  }
  return s + `<text x="${W - 30}" y="16" font-size="12" fill="var(--ink)">N ↑</text></svg>`;
}

/** Beat times on a seconds axis, one row per play-through. */
function timelineSvg(runs, names) {
  const max = Math.ceil(Math.max(...runs.map((r) => r.end)) / 10) * 10, W = 900, rowH = 62, L = 110, R = 18, Hh = runs.length * rowH + 30;
  const x = (t) => L + (t / max) * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" style="width:100%;height:auto" role="img" aria-label="Beat times for each play-through">`;
  for (let t = 0; t <= max; t += 10) s += `<line x1="${x(t)}" x2="${x(t)}" y1="8" y2="${Hh - 20}" stroke="var(--line)"/><text x="${x(t)}" y="${Hh - 6}" font-size="11" fill="var(--mute)" text-anchor="middle">${t}s</text>`;
  runs.forEach((r, i) => {
    const y = 26 + i * rowH + 14;
    s += `<text x="0" y="${y + 4}" font-size="12" fill="var(--ink)">${esc(r.label)}</text><line x1="${x(0)}" x2="${x(r.end)}" y1="${y}" y2="${y}" stroke="var(--mute)" stroke-width="2"/>`;
    Object.entries(r.beats).filter(([id]) => names[id]).forEach(([id, t], k) => {
      const up = k % 2 === 0;
      s += `<circle cx="${x(t)}" cy="${y}" r="4" fill="#c9772e"><title>${esc(names[id])} ${t}s</title></circle><text x="${x(t)}" y="${up ? y - 9 : y + 17}" font-size="10" fill="var(--ink)" text-anchor="middle">${esc(names[id])}</text>`;
    });
  });
  return s + '</svg>';
}

const list = (items, html = false) => `<ul>${items.map((p) => `<li>${html ? p : esc(p)}</li>`).join('')}</ul>`;

const PAGES = {
  redesign() {
    const r = H.redesign;
    const runRows = r.runs.map((x) => ({ run: x.label, total: x.end.toFixed(1) + ' s', gaps: x.gaps, note: x.note }));
    return `<h1>Opening redesign</h1><p class="mute">Updated ${esc(r.updated)}. ${esc(r.intro)}</p>
      <div class="card"><h3>Play it</h3>${list(r.launch, true)}</div>
      <h2>Before: pass 1</h2><div class="card">${list(r.diagnosis)}</div>${gallery(r.before)}
      <h2>Concept references for this pass</h2><p class="mute">${esc(r.refsNote)}</p>${gallery(r.refs, true)}
      <h2>Route and beats</h2>
      <div class="pair"><div class="card">${mapSvg(r.map)}<p class="mute" style="font-size:13px">${esc(r.map.legend)}</p></div>
      <div class="card"><h3>Sequence</h3><ol>${r.beats.map((b) => `<li>${chip(b.status)}<b>${esc(b.beat)}</b> <span class="mute">${esc(b.mud)}</span></li>`).join('')}</ol><p class="mute" style="font-size:13px">${esc(r.beatNote)}</p></div></div>
      ${table(r.beats, [['status', 'Status'], ['beat', 'Beat'], ['purpose', 'Purpose'], ['trigger', 'Trigger'], ['behavior', 'Behavior'], ['mud', 'Agent, mud'], ['sidewalk', 'Agent, sidewalk']])}
      <h2>Observed timing</h2><p class="mute">${esc(r.timingNote)}</p><div class="card">${timelineSvg(r.runs, r.beatNames)}</div>
      ${table(runRows, [['run', 'Play-through'], ['total', 'Start → end card'], ['gaps', 'Gaps between beats'], ['note', 'Notes']])}
      <h2>After: captures</h2><p class="mute">${esc(r.afterNote)}</p>${gallery(r.after)}
      <h2>Clips</h2>${gallery(r.clips, true)}
      <h2>Before and after</h2>${r.compare.map((it) => `<div class="card"><h3>${esc(it.title)}</h3><div class="pair">${media({ ...it.before, title: 'Before · ' + (it.before.title || '') })}${media({ ...it.after, title: 'After · ' + (it.after.title || '') })}</div><p>${esc(it.note)}</p></div>`).join('')}
      <h2>Current problems</h2>${list(r.problems)}
      <h2>Not verified</h2>${list(r.unverified)}
      <h2>Next steps</h2>${list(r.next)}
      <h2>Decisions and assumptions</h2>${list(r.assumptions)}`;
  },
  overview() {
    const o = H.overview;
    return `<h1>Overview</h1><p class="mute">Updated ${esc(H.updated)}. ${esc(o.intro)}</p>
      <div class="card"><h3>Current goal</h3><p>${esc(o.goal)}</p></div>
      <div class="card"><h3>Playable build</h3><ul>${o.builds.map((b) => `<li>${chip(b.status)}${b.href ? `<a href="${esc(b.href)}">${esc(b.label)}</a>` : esc(b.label)} <span class="mute">${esc(b.note)}</span></li>`).join('')}</ul></div>
      <div class="card"><h3>Controls</h3>${table(o.controls, [['action', 'Action'], ['keys', 'Keyboard'], ['touch', 'Touch']])}</div>
      <h2>Progress</h2>${table(o.progress, [['status', 'Status'], ['item', 'Item'], ['note', 'Notes']])}
      ${o.checks?.length ? `<h2>Latest automated checks</h2><p class="mute">From <code>npm run playtest</code> (playtest-output/results.json). Agent-driven, not a human playtest.</p>${table(o.checks.map(([name, what, st]) => ({ status: st || 'agent-tested', name, what })), [['status', 'Status'], ['name', 'Check'], ['what', 'Result']])}` : ''}
      <h2>Next steps</h2><ul>${o.next.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <h2>Not verified / open</h2><ul>${o.unverified.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <h2>How this hub works</h2><ul>${o.howto.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
  },
  route() {
    const r = H.route;
    return `<h1>Long route (slice v1)</h1>${r.superseded ? `<div class="card">${chip('superseded')} ${esc(r.superseded)}</div>` : ''}<p>${esc(r.intro)}</p>
      <div class="pair"><div class="card">${routeSvg(r)}<p class="mute" style="font-size:13px">${esc(r.legend)}</p></div>
      <div class="card"><h3>Pacing</h3>${table(r.sections, [['name', 'Section'], ['status', 'Status'], ['feel', 'Intended feel'], ['time', 'Time']])}</div></div>
      <h2>Locations</h2>${r.sections.map((s) => `<div class="card"><h3>${chip(s.status)}${esc(s.name)}</h3><p>${esc(s.detail)}</p>${s.shots?.length ? s.shots.map(vg).join('') : '<p class="mute">No gameplay capture of this section yet.</p>'}</div>`).join('')}
      <h2>Decisions and assumptions</h2><ul>${r.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`;
  },
  art() {
    const a = H.art;
    return `<h1>Art and assets</h1><p>${esc(a.intro)}</p>
      <h2>Concept references</h2><p class="mute">${esc(a.refsNote)}</p>${gallery(a.refs, true)}
      <h2>Built asset sheets</h2>${gallery(a.sheets, true)}
      <h2>Models in use</h2>${table(a.models, [['status', 'Status'], ['file', 'File'], ['source', 'Source'], ['license', 'License'], ['use', 'Intended use']])}
      <h2>Code-built pieces</h2>${table(a.code, [['status', 'Status'], ['what', 'What'], ['where', 'Where'], ['use', 'Use in the slice']])}`;
  },
  characters() {
    const c = H.characters;
    return `<h1>Characters</h1><p>${esc(c.intro)}</p>
      <h2>Current stand-ins (in the game)</h2>${gallery(c.standins)}
      <h2>Future model references (not in the game)</h2><p class="mute">${esc(c.futureNote)}</p>${gallery(c.future)}
      <h2>Story roles (from the brief, for reference only)</h2>${table(c.roles, [['name', 'Character'], ['role', 'Role'], ['slice', 'In this slice']])}`;
  },
  motion() {
    const m = H.motion;
    return `<h1>Motion tests</h1><div class="card"><p><b>${esc(m.deferred)}</b></p></div><p>${esc(m.intro)}</p>
      ${m.tests.map((t) => `<div class="card"><h3>${chip(t.status)}${esc(t.title)}</h3><p class="mute">${esc(t.date)} · build ${esc(t.build)}</p>
        <p><b>Conditions:</b> ${esc(t.conditions)}</p>${gallery(t.clips, true)}
        <h3>Findings</h3><ul>${t.findings.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${t.revisions?.length ? `<h3>Revisions</h3><ul>${t.revisions.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</div>`).join('')}`;
  },
  compare() {
    const c = H.compare;
    return `<h1>Before and after</h1><p>${esc(c.intro)}</p>${c.items.map((it) => `<div class="card"><h3>${esc(it.title)}</h3><div class="pair">${media({ ...it.before, title: 'Before · ' + (it.before.title || '') })}${media({ ...it.after, title: 'After · ' + (it.after.title || '') })}</div><p>${esc(it.note)}</p></div>`).join('')}`;
  },
};
const TABS = [['overview', 'Overview'], ['redesign', 'Opening redesign'], ['route', 'Long route (v1)'], ['art', 'Art & assets'], ['characters', 'Characters'], ['motion', 'Motion tests'], ['compare', 'Before & after']];

function render() {
  const page = (location.hash.slice(1) || 'overview');
  const key = PAGES[page] ? page : 'overview';
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<a href="#${k}" class="${k === key ? 'on' : ''}">${l}</a>`).join('');
  vgId = 0;
  $('#main').innerHTML = PAGES[key]();
  scrollTo(0, 0);
}
$('#legend').innerHTML = 'Status: ' + Object.keys(STATUS).map(chip).join(' ');
addEventListener('hashchange', render);
render();
