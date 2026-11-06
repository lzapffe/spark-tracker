/* =====================================================================
   SPARK-tracker: the web page (step 3: core pages).

   How it works:
   - All data comes from the Google Sheet through the Apps Script web app
     (Kode.gs). On GitHub Pages each call carries the app key saved in this
     browser. If the page is ever served by Apps Script itself, it uses
     google.script.run instead (no key needed).
   - The page keeps one copy of the data (state.d), draws the page you are
     on, and sends every change straight to the sheet.
   - Pages are chosen with the address (#oversikt, #prosjekter, ...).
   ===================================================================== */
(function () {
  'use strict';

  // ---- Constants -------------------------------------------------------
  var URL_KEY = 'spark_url', APP_KEY = 'spark_key', THEME_KEY = 'spark_theme', VIEW_KEY = 'spark_projview';
  var PHASES = ['Søknad', '1. år', '2. år', 'Avslutning', 'Arkivert'];
  var ACTIVE = ['1. år', '2. år', 'Avslutning'];
  var TRACKS = ['Kontrakt', 'Utbetaling', 'Rapporter', 'Mentor', 'Workshop', 'Intervju'];
  var STEPS = ['Fase 1', 'Prioritert av fakultet', 'Fase 2', 'Pitch', 'Rektoratets vedtak', 'Takket ja'];
  var STATUSES = ['Ikke startet', 'Pågår', 'Venter på', 'Ferdig', 'Ikke aktuelt'];
  var FACULTIES = ['HF', 'JUS', 'MED', 'MN', 'OD', 'SV', 'TF', 'UV', 'Museum', 'Senter', 'Annet'];
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

  var state = { d: null, view: 'oversikt', param: '', filters: {} };


  // ---- Small helpers ---------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return v === undefined ? '' : false; } }
  function today() { return state.d ? state.d.today : new Date().toISOString().slice(0, 10); }
  function addDays(d, n) { var p = d.split('-').map(Number); var x = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return x.toISOString().slice(0, 10); }
  function fmtDate(d) { if (!d) return ''; var p = d.split('-').map(Number); return p[2] + '. ' + MONTHS[p[1] - 1] + (p[0] !== Number(today().slice(0, 4)) ? ' ' + p[0] : ''); }
  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2200); }
  function byId(tab, id) { return (state.d[tab] || []).find(function (r) { return r.id === id; }) || null; }
  function option(v, cur, label) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label == null ? v : label) + '</option>'; }
  function options(list, cur, blank) { return (blank != null ? option('', cur, blank) : '') + list.map(function (v) { return option(v, cur); }).join(''); }

  // The short name of a project or applicant (same ID for both).
  function shortName(id) { var p = byId('Prosjekter', id) || byId('Søkere', id); return p ? (p.kortnavn || p.tittel || '(uten navn)') : ''; }


  // ---- Talking to the sheet ---------------------------------------------
  // Returns a Promise with the function's result.
  function api(fn, arg) {
    if (window.google && google.script && google.script.run) {
      return new Promise(function (ok, fail) { google.script.run.withSuccessHandler(ok).withFailureHandler(fail)[fn](arg); });
    }
    var url = store(URL_KEY), key = store(APP_KEY);
    if (!url || !key) { showConnect(''); return Promise.reject(new Error('Ikke koblet til')); }
    return fetch(url, { method: 'POST', body: JSON.stringify({ appKey: key, fn: fn, args: [arg] }), redirect: 'follow', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) return res.result;
        var msg = (res && res.error) || 'Ukjent feil';
        if (msg === 'Wrong key') showConnect('Nøkkelen ble ikke godtatt. Sjekk den og prøv igjen.');
        if (msg === 'Remote access is off') showConnect('Tilgangen er slått av i Apps Script (kjør enableRemote).');
        throw new Error(msg);
      }, function (e) { throw new Error('Får ikke kontakt med regnearket (' + (e && e.message || e) + ')'); });
  }

  // Saves rows in one tab and puts the saved versions into the local copy.
  function save(tab, rows, remove) {
    return api('api_save', { tab: tab, rows: rows || [], remove: remove || [] }).then(function (saved) {
      var list = state.d[tab];
      (saved || []).forEach(function (r) { var i = list.findIndex(function (x) { return x.id === r.id; }); if (i >= 0) list[i] = r; else list.push(r); });
      (remove || []).forEach(function (id) { var i = list.findIndex(function (x) { return x.id === id; }); if (i >= 0) list.splice(i, 1); });
      return saved;
    }).catch(fail);
  }

  // A workflow call (admit, phase change ...) is followed by a full reload,
  // since it can change several tabs at once.
  function run(fn, arg, msg) {
    return api(fn, arg).then(function (res) { if (msg) toast(msg); return load(true).then(function () { return res; }); }).catch(fail);
  }

  function fail(e) { toast('Feil: ' + (e && e.message || e)); throw e; }

  function load(quiet) {
    if (!quiet) $('main').innerHTML = '<div class="loading">Henter data …</div>';
    return api('api_getData').then(function (d) {
      state.d = d;
      $('connect').hidden = true; $('shell').hidden = false; $('fab').hidden = false;
      render();
    }).catch(function (e) { if (!quiet) $('main').innerHTML = '<div class="panel err">Kunne ikke hente data: ' + esc(e.message) + '</div>'; });
  }


  // ---- Task logic ---------------------------------------------------------
  function openTask(t) { return t.status !== 'Ferdig' && t.status !== 'Ikke aktuelt'; }
  function isLate(t) { return openTask(t) && t.frist && t.frist < today(); }
  function isVisible(t) { return !t.vis_fra || t.vis_fra <= today(); }
  function progressOf(t) { return t.progress_id ? byId('Progress', t.progress_id) : null; }

  // Status of one project on one track (for cards and the big grid).
  function trackStatus(pid, track) {
    var ts = state.d.Oppgaver.filter(function (t) { return t.prosjekt_id === pid && t.spor === track; });
    if (!ts.length) return { c: 'na', label: '–' };
    var open = ts.filter(openTask);
    if (!open.length) return { c: 'done', label: 'Ferdig' };
    var late = open.filter(isLate);
    if (late.length) return { c: 'miss', label: 'Forfalt' };
    var next = open.filter(function (t) { return t.frist; }).sort(function (a, b) { return a.frist < b.frist ? -1 : 1; })[0];
    var started = open.some(function (t) { return t.status === 'Pågår' || t.status === 'Venter på'; });
    var p = byId('Prosjekter', pid);
    if (p && p.forsinket === 'ja' && next && next.opprinnelig_frist && next.frist !== next.opprinnelig_frist) return { c: 'late', label: 'Utsatt' };
    if (next) return { c: started ? 'prog' : (isVisible(next) ? 'prog' : 'na'), label: (isVisible(next) || started ? 'Frist ' : 'Senere: ') + fmtDate(next.frist) };
    return { c: 'prog', label: (ts.length - open.length) + ' av ' + ts.length };
  }

  // One task row (round checkbox, title, project, phase, date).
  function taskRow(t, opts) {
    opts = opts || {};
    var ring = t.status === 'Ferdig' ? 'done' : (t.status === 'Pågår' || t.status === 'Venter på') ? 'started' : '';
    var meta = [];
    if (t.prosjekt_id && !opts.noProject) meta.push('<button class="plink" data-go="prosjekt/' + esc(t.prosjekt_id) + '">' + esc(shortName(t.prosjekt_id)) + '</button>');
    else if (!t.prosjekt_id && !opts.noProject) meta.push(t.runde_id ? 'Hendelse' : 'Generell');
    if (t.fase) meta.push('<span class="ph">' + esc(t.fase) + '</span>');
    if (t.type === 'epost') meta.push('<span class="chip c-info">E-post</span>');
    if (t.type === 'notater') meta.push('<span class="chip c-na">Notater</span>');
    if (t.status === 'Venter på') meta.push('<span class="chip c-prog">Venter på ' + esc(t.venter_paa || '') + '</span>');
    var cl = t.sjekkliste ? JSON.parse(t.sjekkliste) : [];
    if (cl.length) meta.push(cl.filter(function (x) { return x.ferdig; }).length + '/' + cl.length);
    var when = '';
    if (t.status === 'Venter på' && t.oppfolging) when = '<span class="when' + (t.oppfolging <= today() ? ' late' : '') + '">følg opp ' + fmtDate(t.oppfolging) + '</span>';
    else if (t.frist) when = '<span class="when' + (isLate(t) ? ' late' : '') + '">' + (isLate(t) ? 'forfalt ' : '') + fmtDate(t.frist) + '</span>';
    else if (!t.prosjekt_id && progressOf(t) && progressOf(t).maaned) when = '<span class="when">ca. ' + MONTHS[Number(progressOf(t).maaned) - 1] + '</span>';
    return '<div class="task' + (t.status === 'Ferdig' ? ' isdone' : '') + '">' +
      '<button class="ring ' + ring + '" data-done="' + esc(t.id) + '" aria-label="Merk som ferdig" title="Ferdig"></button>' +
      '<div class="t" data-task="' + esc(t.id) + '"><div class="tt">' + esc(t.tittel) + '</div><div class="meta">' + meta.join('') + '</div></div>' +
      '<div class="right">' + when + (openTask(t) && t.status !== 'Pågår' ? '<button class="startbtn" data-start="' + esc(t.id) + '" title="Merk som påbegynt">◐</button>' : '') + '</div></div>';
  }
  function taskList(list, opts) { return list.length ? '<div class="tasklist">' + list.map(function (t) { return taskRow(t, opts); }).join('') + '</div>' : '<div class="empty">' + ((opts && opts.empty) || 'Ingenting her.') + '</div>'; }
  function sortTasks(list) { return list.slice().sort(function (a, b) { return (a.frist || '9999') < (b.frist || '9999') ? -1 : (a.frist || '9999') > (b.frist || '9999') ? 1 : (a.tittel < b.tittel ? -1 : 1); }); }


  // ---- Navigation ------------------------------------------------------------
  var NAV = [
    ['oversikt', 'Oversikt'], ['oppgaver', 'Oppgaver'], ['prosjekter', 'Prosjekter'], ['sokere', 'Søkere'],
    ['-', 'Mer'], ['progress', 'Progress'], ['innboks', 'Innboks'], ['innstillinger', 'Innstillinger']
  ];
  function renderNav() {
    var d = state.d;
    var counts = {
      oppgaver: d.Oppgaver.filter(function (t) { return isLate(t); }).length,
      innboks: d.Innboks.filter(function (i) { return i.sortert !== 'ja'; }).length,
      sokere: d.Søkere.filter(function (s) { return s.status === 'Aktiv' || !s.status; }).length
    };
    var cur = state.view === 'prosjekt' ? 'prosjekter' : state.view;
    $('side').innerHTML = '<div class="brand">SPARK<small>Samfunnsinnovasjon</small></div>' + NAV.map(function (n) {
      if (n[0] === '-') return '<div class="navgroup">' + n[1] + '</div>';
      var c = counts[n[0]] ? '<span class="count">' + counts[n[0]] + '</span>' : '';
      return '<a class="nav' + (cur === n[0] ? ' on' : '') + '" href="#' + n[0] + '">' + n[1] + c + '</a>';
    }).join('') + '<div class="spacer"></div>';
  }

  function route() {
    var h = (location.hash || '#oversikt').slice(1).split('/');
    state.view = h[0] || 'oversikt'; state.param = h[1] || '';
    if (state.d) render();
  }

  function render() {
    renderNav();
    var pages = { oversikt: pageOverview, oppgaver: pageTasks, prosjekter: pageProjects, prosjekt: pageProject, sokere: pageApplicants, progress: pageProgress, innboks: pageInbox, innstillinger: pageSettings };
    ($('main').innerHTML = (pages[state.view] || pageOverview)());
    window.scrollTo(0, 0);
  }


  // ---- Page: Oversikt -----------------------------------------------------------
  function pageOverview() {
    var d = state.d, t = today(), week = addDays(t, 7), year = t.slice(0, 4);
    var active = d.Prosjekter.filter(function (p) { return ACTIVE.indexOf(p.fase) >= 0; });
    var open = d.Oppgaver.filter(openTask);
    var late = open.filter(isLate);
    var thisWeek = open.filter(function (x) { return x.frist && x.frist >= t && x.frist <= week; });
    var follow = open.filter(function (x) { return x.status === 'Venter på' && x.oppfolging && x.oppfolging <= t; });
    var pressing = sortTasks(late.concat(follow.filter(function (x) { return late.indexOf(x) < 0; }), thisWeek.filter(function (x) { return late.indexOf(x) < 0 && follow.indexOf(x) < 0; })));
    var applicants = d.Søkere.filter(function (s) { return s.soknadsaar === year && (s.status === 'Aktiv' || !s.status); });
    var inbox = d.Innboks.filter(function (i) { return i.sortert !== 'ja'; }).length;
    var review = d.Innstillinger.gjennomgang_aapen === 'ja';

    return head('Oversikt', fmtLong(t)) +
      (review ? '<div class="banner"><div><b>Nyttårsgjennomgang</b> · tid for å flytte prosjektene til neste fase.</div><span class="hint">Gjennomgangssiden kommer i steg 4. Til da: bruk «Endre fase» på hvert prosjekt.</span></div>' : '') +
      '<div class="kpis">' +
        kpi('Aktive prosjekter', active.length) + kpi('Søkere ' + year, applicants.length) +
        kpi('Forfalt', late.length, late.length > 0) + kpi('Frist denne uka', thisWeek.length) +
      '</div>' +
      '<div class="cols">' +
        '<section class="panel"><h2>Mest presserende <span class="hint">forfalt, oppfølging, denne uka</span></h2>' + taskList(pressing, { empty: 'Ingenting forfalt eller med frist denne uka.' }) +
          (inbox ? '<p class="empty"><a href="#innboks">' + inbox + ' ' + (inbox === 1 ? 'notat' : 'notater') + ' i innboksen</a> venter på å bli sortert.</p>' : '') + '</section>' +
        '<section class="panel"><h2>Prosjekter <span class="hint"><a href="#prosjekter">alle</a></span></h2>' + (active.length ? '<div class="cards">' + active.map(projectCard).join('') + '</div>' : '<div class="empty">Ingen aktive prosjekter ennå. Legg til under Prosjekter, eller ta opp en søker.</div>') + '</section>' +
      '</div>' +
      '<section class="panel"><h2>Hele bildet <span class="hint">ett prosjekt per rad, ett spor per kolonne</span></h2>' + bigGrid(active) + '</section>';
  }
  function kpi(l, n, warn) { return '<div class="kpi"><div class="l">' + esc(l) + '</div><div class="n' + (warn ? ' warn' : '') + '">' + n + '</div></div>'; }
  function head(title, sub, tools) { return '<div class="top"><div><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (tools ? '<div class="tools">' + tools + '</div>' : '') + '</div>'; }
  function fmtLong(d) { var days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']; var p = d.split('-').map(Number); var wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); return days[wd].charAt(0).toUpperCase() + days[wd].slice(1) + ' ' + p[2] + '. ' + ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'][p[1] - 1] + ' ' + p[0]; }

  function bigGrid(list) {
    if (!list.length) return '<div class="empty">Ingen aktive prosjekter.</div>';
    return '<div class="tablewrap"><table class="t grid"><tr><th>Prosjekt</th><th>Fase</th>' + TRACKS.map(function (t) { return '<th>' + t + '</th>'; }).join('') + '</tr>' +
      list.map(function (p) {
        return '<tr class="click" data-go="prosjekt/' + esc(p.id) + '"><td class="strong">' + esc(p.kortnavn) + '</td><td><span class="ph">' + esc(p.fase) + '</span>' + (p.forsinket === 'ja' ? ' <span class="chip c-late">Forsinket</span>' : '') + '</td>' +
          TRACKS.map(function (tr) { var s = trackStatus(p.id, tr); return '<td><span class="chip c-' + s.c + '">' + esc(s.label) + '</span></td>'; }).join('') + '</tr>';
      }).join('') + '</table></div>';
  }

  function projectCard(p) {
    var bars = TRACKS.map(function (tr) { return '<i class="' + trackStatus(p.id, tr).c + '" title="' + tr + '"></i>'; }).join('');
    var open = state.d.Oppgaver.filter(function (t) { return t.prosjekt_id === p.id && openTask(t); });
    var late = open.filter(isLate).length;
    var chip = p.forsinket === 'ja' ? '<span class="chip c-late">Forsinket</span>' : late ? '<span class="chip c-miss">' + late + ' forfalt</span>' : '<span class="chip c-na">' + esc(p.fase) + '</span>';
    return '<button class="pcard" type="button" data-go="prosjekt/' + esc(p.id) + '"><div class="h"><b>' + esc(p.kortnavn) + '</b>' + chip + '</div>' +
      '<div class="who">' + esc([p.fakultet, p.enhet, p.fase].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="bars">' + bars + '</div><div class="barlabels">' + TRACKS.map(function (t) { return '<span>' + t.slice(0, 5) + '</span>'; }).join('') + '</div></button>';
  }


  // ---- Page: Oppgaver -------------------------------------------------------------
  function pageTasks() {
    var d = state.d, f = state.filters, t = today(), year = t.slice(0, 4);
    var monthEnd = t.slice(0, 8) + '31';
    var list = d.Oppgaver.filter(function (x) {
      if (!f.showDone && !openTask(x)) return false;
      if (f.fase && x.fase !== f.fase) return false;
      if (f.prosjekt && x.prosjekt_id !== f.prosjekt) return false;
      if (f.type && x.type !== f.type) return false;
      if (f.q && (x.tittel + ' ' + x.notat).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
      return true;
    });
    var dated = sortTasks(list.filter(function (x) { return x.frist && (x.frist <= monthEnd || isVisible(x)); }));
    var general = list.filter(function (x) { return !x.prosjekt_id && !x.frist && !x.liste && x.aar === year && x.type !== 'notater'; })
      .sort(function (a, b) { var pa = progressOf(a), pb = progressOf(b); return Number(pa && pa.maaned || 99) - Number(pb && pb.maaned || 99); });
    var ongoing = list.filter(function (x) { return x.liste === 'Pågående' || (x.type === 'notater' && !x.liste); });
    var backlog = list.filter(function (x) { return x.liste === 'Backlog'; });
    var undatedProj = list.filter(function (x) { return x.prosjekt_id && !x.frist && !x.liste; });
    var later = list.filter(function (x) { return x.frist && !(x.frist <= monthEnd || isVisible(x)); });

    var projects = d.Prosjekter.filter(function (p) { return p.fase !== 'Arkivert'; }).concat(d.Søkere.filter(function (s) { return s.status === 'Aktiv' || !s.status; }));
    var tools = '<input type="text" class="search" id="fQ" placeholder="Søk i oppgaver" value="' + esc(f.q || '') + '">' +
      '<select id="fFase">' + options(['Søknad', '1. år', '2. år', 'Avslutning', 'Felles'], f.fase || '', 'Alle faser') + '</select>' +
      '<select id="fProsjekt">' + option('', f.prosjekt || '', 'Alle prosjekter') + projects.map(function (p) { return option(p.id, f.prosjekt || '', p.kortnavn); }).join('') + '</select>' +
      '<select id="fType">' + option('', f.type || '', 'Alle typer') + option('oppgave', f.type || '', 'Oppgave') + option('epost', f.type || '', 'E-post') + option('notater', f.type || '', 'Notater') + '</select>' +
      '<label class="check"><input type="checkbox" id="fDone"' + (f.showDone ? ' checked' : '') + '> Vis ferdige</label>' +
      '<button class="btn primary" data-act="newtask">Ny oppgave</button>';

    return head('Oppgaver', '', tools) +
      '<div class="cols">' +
        '<section class="panel"><h2>Denne måneden <span class="hint">frist nå eller forfalt</span></h2>' + taskList(dated, { empty: 'Ingen frister denne måneden.' }) + '</section>' +
        '<section class="panel"><h2>Generelle oppgaver ' + year + ' <span class="hint">uten frist, alltid her</span></h2>' + groupByPhase(general) + '</section>' +
      '</div>' +
      '<div class="cols">' +
        '<section class="panel"><h2>Pågående <span class="hint">det du jobber med</span></h2>' + taskList(ongoing, { empty: 'Ingenting merket som pågående.' }) + '</section>' +
        '<section class="panel"><h2>Backlog <span class="hint">uten dato</span></h2>' + taskList(backlog.concat(undatedProj), { empty: 'Tom.' }) + '</section>' +
      '</div>' +
      (later.length ? '<section class="panel"><h2>Senere <span class="hint">dukker opp ' + (d.Innstillinger.vises_dager_for || 42) + ' dager før fristen</span></h2>' + taskList(sortTasks(later)) + '</section>' : '');
  }
  function groupByPhase(list) {
    if (!list.length) return '<div class="empty">Ingen generelle oppgaver for i år. Lag dem fra Progress-siden.</div>';
    return ['Søknad', '1. år', '2. år', 'Avslutning', 'Felles'].map(function (ph) {
      var l = list.filter(function (x) { return x.fase === ph; });
      return l.length ? '<div class="group-h">' + ph + '</div>' + taskList(l, { noProject: true }) : '';
    }).join('');
  }


  // ---- Page: Prosjekter -------------------------------------------------------------
  function pageProjects() {
    var d = state.d, f = state.filters, view = store(VIEW_KEY) || 'kort';
    var list = d.Prosjekter.filter(function (p) {
      if (f.pfase ? p.fase !== f.pfase : p.fase === 'Arkivert') return false;
      if (f.kull && p.kull !== f.kull) return false;
      if (f.fak && p.fakultet !== f.fak) return false;
      if (f.delayed && p.forsinket !== 'ja') return false;
      if (f.pq && (p.kortnavn + ' ' + p.tittel + ' ' + p.leder).toLowerCase().indexOf(f.pq.toLowerCase()) < 0) return false;
      return true;
    }).sort(function (a, b) { return ACTIVE.indexOf(a.fase) - ACTIVE.indexOf(b.fase) || (a.kortnavn < b.kortnavn ? -1 : 1); });
    var kull = Array.from(new Set(d.Prosjekter.map(function (p) { return p.kull; }).filter(Boolean))).sort();

    var tools = '<input type="text" class="search" id="fPq" placeholder="Søk" value="' + esc(f.pq || '') + '">' +
      '<select id="fPfase">' + option('', f.pfase || '', 'Aktive') + PHASES.slice(1).map(function (p) { return option(p, f.pfase || ''); }).join('') + '</select>' +
      '<select id="fKull">' + options(kull, f.kull || '', 'Alle kull') + '</select>' +
      '<select id="fFak">' + options(FACULTIES, f.fak || '', 'Alle fakulteter') + '</select>' +
      '<label class="check"><input type="checkbox" id="fDelayed"' + (f.delayed ? ' checked' : '') + '> Forsinket</label>' +
      '<span class="seg"><button data-view="kort" aria-pressed="' + (view === 'kort') + '">Kort</button><button data-view="rader" aria-pressed="' + (view === 'rader') + '">Rader</button></span>' +
      '<button class="btn primary" data-act="newproject">Nytt prosjekt</button>';

    var body;
    if (!list.length) body = '<div class="panel empty">Ingen prosjekter med dette utvalget.</div>';
    else if (view === 'kort') body = '<div class="cards">' + list.map(projectCard).join('') + '</div>';
    else body = '<div class="panel tablewrap"><table class="t"><tr><th>Prosjekt</th><th>Fase</th><th>Fakultet</th><th>Enhet</th><th>Prosjektleder</th><th>Kull</th><th>Slutt</th><th>Åpne</th><th>Forfalt</th></tr>' +
      list.map(function (p) {
        var open = d.Oppgaver.filter(function (t) { return t.prosjekt_id === p.id && openTask(t); });
        return '<tr class="click" data-go="prosjekt/' + esc(p.id) + '"><td class="strong">' + esc(p.kortnavn) + '</td><td><span class="ph">' + esc(p.fase) + '</span>' + (p.forsinket === 'ja' ? ' <span class="chip c-late">Forsinket</span>' : '') + '</td><td>' + esc(p.fakultet) + '</td><td>' + esc(p.enhet) + '</td><td>' + esc(p.leder) + '</td><td>' + esc(p.kull) + '</td><td>' + esc(fmtDate(p.ny_sluttdato || p.sluttdato)) + '</td><td>' + open.length + '</td><td>' + (open.filter(isLate).length || '') + '</td></tr>';
      }).join('') + '</table></div>';
    return head('Prosjekter', list.length + ' ' + (list.length === 1 ? 'prosjekt' : 'prosjekter'), tools) + body +
      (!f.pfase ? '<section class="panel"><h2>Hele bildet</h2>' + bigGrid(list) + '</section>' : '');
  }


  // ---- Page: one project -------------------------------------------------------------
  function pageProject() {
    var d = state.d, p = byId('Prosjekter', state.param);
    if (!p) return head('Fant ikke prosjektet') + '<a href="#prosjekter">Tilbake til prosjektene</a>';
    var tasks = d.Oppgaver.filter(function (t) { return t.prosjekt_id === p.id; });
    var open = sortTasks(tasks.filter(openTask)), done = tasks.filter(function (t) { return !openTask(t); });
    var logs = d.Logg.filter(function (l) { return l.prosjekt_id === p.id; }).sort(function (a, b) { return a.dato < b.dato ? 1 : -1; });
    var docs = d.Dokumenter.filter(function (x) { return x.prosjekt_id === p.id; });
    var delays = d.Forsinkelser.filter(function (x) { return x.prosjekt_id === p.id; });
    var hist = d.Historikk.filter(function (h) { return h.rad_id === p.id || tasks.some(function (t) { return t.id === h.rad_id; }); }).slice(-25).reverse();
    var mentor = p.mentor_id ? byId('Kontakter', p.mentor_id) : null;

    var fact = function (l, v) { return '<div><span>' + l + '</span>' + (esc(v) || '–') + '</div>'; };
    var tools = '<button class="btn" data-act="editproject" data-id="' + esc(p.id) + '">Rediger</button>' +
      '<button class="btn" data-act="phase" data-id="' + esc(p.id) + '">Endre fase</button>' +
      '<button class="btn primary" data-act="newtask" data-project="' + esc(p.id) + '">Ny oppgave</button>';

    return '<div class="top"><div class="ptitle"><div class="short"><a href="#prosjekter">Prosjekter</a> / ' + esc(p.kortnavn) + '</div><h1>' + esc(p.tittel || p.kortnavn) + '</h1>' +
        '<div class="sub"><span class="ph">' + esc(p.fase) + '</span> ' + (p.forsinket === 'ja' ? '<span class="chip c-late">Forsinket</span> ' : '') + esc([p.fakultet, p.enhet].filter(Boolean).join(' · ')) + '</div></div>' +
        '<div class="tools">' + tools + '</div></div>' +
      '<section class="panel"><div class="facts">' +
        fact('Prosjektleder', p.leder) + fact('E-post', p.epost) + fact('Kull (søknadsår)', p.kull) + fact('Startdato', fmtDate(p.startdato)) +
        fact('I fasen siden', fmtDate(p.fase_start)) + fact('Planlagt slutt', fmtDate(p.sluttdato)) + (p.ny_sluttdato ? fact('Ny slutt', fmtDate(p.ny_sluttdato)) : '') +
        fact('Mentor', mentor ? mentor.navn : '') + fact('Samarbeid', p.partnere) +
      '</div>' + (p.maal ? '<p>' + esc(p.maal) + '</p>' : '') + (p.forsinkelse_aarsak ? '<p class="empty">Forsinkelse: ' + esc(p.forsinkelse_aarsak) + '</p>' : '') + (p.merknader ? '<p class="empty">' + esc(p.merknader) + '</p>' : '') + '</section>' +
      '<section class="panel"><h2>Spor</h2>' + bigGrid([p]) + '</section>' +
      '<div class="cols">' +
        '<section class="panel"><h2>Oppgaver <span class="hint">' + open.length + ' åpne</span></h2>' + phaseTasks(open) +
          (done.length ? '<details><summary class="group-h">Ferdige (' + done.length + ')</summary>' + taskList(done, { noProject: true }) + '</details>' : '') + '</section>' +
        '<div class="cols1">' +
          '<section class="panel"><h2>Logg <span class="hint">møter, samtaler, notater</span></h2><div class="loglist">' +
            (logs.length ? logs.map(function (l) { return '<div class="logitem"><div class="d">' + esc(fmtDate(l.dato)) + ' · ' + esc(l.type || 'Notat') + '</div>' + esc(l.tekst) + '</div>'; }).join('') : '<div class="empty">Ingen notater ennå.</div>') +
            '</div><form class="addrow" data-form="log" data-id="' + esc(p.id) + '"><select id="logType">' + options(['Notat', 'Sjekk-inn', 'Mentormøte', 'E-post', 'Telefon', 'Møte'], 'Notat') + '</select><input type="text" id="logText" placeholder="Skriv et notat"><button class="btn" type="submit">Legg til</button></form></section>' +
          '<section class="panel"><h2>Dokumenter <span class="hint">bare lenker</span></h2>' +
            (docs.length ? docs.map(function (x) { return '<div class="logitem"><a href="' + esc(safeUrl(x.lenke)) + '" target="_blank" rel="noopener noreferrer">' + esc(x.tittel || x.lenke) + '</a> <button class="btn ghost small" data-deldoc="' + esc(x.id) + '">Fjern</button></div>'; }).join('') : '<div class="empty">Ingen dokumenter.</div>') +
            '<form class="addrow" data-form="doc" data-id="' + esc(p.id) + '"><input type="text" id="docTitle" placeholder="Navn (f.eks. Kontrakt)"><input type="text" id="docUrl" placeholder="https://…"><button class="btn" type="submit">Legg til</button></form></section>' +
          (delays.length ? '<section class="panel"><h2>Forsinkelser</h2><div class="hist">' + delays.map(function (x) { return '<div>' + esc(fmtDate(x.dato)) + ': ' + esc(x.maaneder) + ' mnd, ' + esc(x.aarsak) + ' (' + esc(x.flyttede) + ' oppgaver flyttet)</div>'; }).join('') + '</div></section>' : '') +
          '<section class="panel"><h2>Historikk <span class="hint">siste endringer</span></h2><div class="hist">' + (hist.length ? hist.map(histLine).join('') : 'Ingen endringer ennå.') + '</div></section>' +
        '</div>' +
      '</div>';
  }
  function phaseTasks(list) {
    if (!list.length) return '<div class="empty">Ingen åpne oppgaver.</div>';
    return PHASES.concat(['Felles', '']).map(function (ph) {
      var l = list.filter(function (t) { return (t.fase || '') === ph; });
      return l.length ? '<div class="group-h">' + (ph || 'Annet') + '</div>' + taskList(l, { noProject: true }) : '';
    }).join('');
  }
  function histLine(h) {
    var when = h.tid ? fmtDate(h.tid.slice(0, 10)) + ' ' + h.tid.slice(11, 16) : '';
    if (h.felt === '(ny rad)') return '<div>' + esc(when) + ' · ' + esc(h.navn) + ' opprettet</div>';
    if (h.felt === '(slettet)') return '<div>' + esc(when) + ' · ' + esc(h.navn) + ' slettet</div>';
    return '<div>' + esc(when) + ' · ' + esc(h.navn) + ': ' + esc(h.felt) + ' ' + esc(h.fra || '–') + ' → ' + esc(h.til || '–') + '</div>';
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : '#'; }


  // ---- Page: Søkere ---------------------------------------------------------------------
  function pageApplicants() {
    var d = state.d, f = state.filters, year = f.syear || today().slice(0, 4);
    var years = Array.from(new Set(d.Søkere.map(function (s) { return s.soknadsaar; }).concat([today().slice(0, 4)]).filter(Boolean))).sort().reverse();
    var inYear = d.Søkere.filter(function (s) { return s.soknadsaar === year; });
    var active = inYear.filter(function (s) { return s.status === 'Aktiv' || !s.status; });
    var closed = inYear.filter(function (s) { return s.status && s.status !== 'Aktiv'; });
    var tools = '<select id="fSyear">' + options(years, year) + '</select><button class="btn primary" data-act="newapplicant">Ny søker</button>';

    var board = '<div class="board">' + STEPS.map(function (st) {
      var l = active.filter(function (s) { return (s.steg || STEPS[0]) === st; });
      return '<div class="col"><h3>' + st + ' <span>' + l.length + '</span></h3>' + l.map(applicantCard).join('') + '</div>';
    }).join('') + '</div>';

    return head('Søkere', 'Søknadsår ' + esc(year) + ' · ' + active.length + ' aktive', tools) + board +
      '<section class="panel"><h2>Avsluttet ' + esc(year) + ' <span class="hint">opptatt, avslått, trukket</span></h2>' +
      (closed.length ? '<div class="tablewrap"><table class="t"><tr><th>Søker</th><th>Status</th><th>Fakultet</th><th>Prosjektleder</th><th>Merknader</th></tr>' + closed.map(function (s) {
        var go = s.status === 'Opptatt' && byId('Prosjekter', s.id) ? ' class="click" data-go="prosjekt/' + esc(s.id) + '"' : ' class="click" data-edit-applicant="' + esc(s.id) + '"';
        return '<tr' + go + '><td class="strong">' + esc(s.kortnavn) + '</td><td><span class="chip ' + (s.status === 'Opptatt' ? 'c-done' : 'c-na') + '">' + esc(s.status) + '</span></td><td>' + esc(s.fakultet) + '</td><td>' + esc(s.leder) + '</td><td>' + esc(s.merknader) + '</td></tr>';
      }).join('') + '</table></div>' : '<div class="empty">Ingen ennå.</div>') + '</section>';
  }
  function applicantCard(s) {
    var i = STEPS.indexOf(s.steg || STEPS[0]);
    var open = state.d.Oppgaver.filter(function (t) { return t.prosjekt_id === s.id && openTask(t); }).length;
    return '<div class="acard"><b>' + esc(s.kortnavn) + '</b><div class="empty">' + esc([s.fakultet, s.leder].filter(Boolean).join(' · ')) + (open ? ' · ' + open + ' oppgaver' : '') + '</div>' +
      '<div class="row">' + (i < STEPS.length - 1 ? '<button class="btn small" data-step="' + esc(s.id) + '">→ ' + STEPS[i + 1] + '</button>' : '') +
      '<button class="btn small" data-edit-applicant="' + esc(s.id) + '">Åpne</button></div>' +
      '<div class="row"><button class="btn small primary" data-admit="' + esc(s.id) + '">Ta opp</button><button class="btn small danger" data-decline="' + esc(s.id) + '">Avslå</button></div></div>';
  }


  // ---- Page: Progress (the year template) --------------------------------------------------
  function pageProgress() {
    var d = state.d, f = state.filters;
    var list = d.Progress.filter(function (s) { return (!f.gfase || s.fase === f.gfase) && (!f.gtype || s.type === f.gtype); })
      .sort(function (a, b) { return Number(a.maaned || 99) - Number(b.maaned || 99) || Number(a.rekkefolge) - Number(b.rekkefolge); });
    var tools = '<select id="fGfase">' + options(['Søknad', '1. år', '2. år', 'Avslutning', 'Felles'], f.gfase || '', 'Alle faser') + '</select>' +
      '<select id="fGtype">' + option('', f.gtype || '', 'Alle typer') + option('generell', f.gtype || '', 'Generell') + option('prosjekt', f.gtype || '', 'Per prosjekt') + '</select>' +
      '<button class="btn" data-act="makegeneral">Lag manglende generelle oppgaver for ' + today().slice(0, 4) + '</button>' +
      '<button class="btn primary" data-act="newstep">Nytt steg</button>';
    return head('Progress', 'Årsplanen: generelle oppgaver kommer hvert år, prosjektoppgaver når et prosjekt går inn i fasen', tools) +
      '<div class="panel tablewrap"><table class="t"><tr><th>Mnd</th><th>Fase</th><th>Spor</th><th>Steg</th><th>Type</th><th>Frist</th><th>Flyttes ved forsinkelse</th><th>Aktiv</th></tr>' +
      list.map(function (s) {
        var when = s.timing === 'maaned' ? 'Slutten av mnd ' + s.maaned : s.timing === 'dato' ? 'Fast ' + s.dato : 'Ingen';
        return '<tr class="click" data-step-edit="' + esc(s.id) + '"><td>' + (s.maaned ? MONTHS[Number(s.maaned) - 1] || s.maaned : '–') + '</td><td><span class="ph">' + esc(s.fase) + '</span></td><td>' + esc(s.spor) + '</td><td class="strong">' + esc(s.tittel) + (s.notater_etter === 'ja' ? ' <span class="chip c-na">+ notater</span>' : '') + '</td><td>' + (s.type === 'generell' ? 'Generell' : 'Per prosjekt') + '</td><td>' + esc(s.type === 'generell' ? '–' : when) + '</td><td>' + esc(s.flyttes_ved_forsinkelse) + '</td><td>' + (s.aktiv === 'nei' ? '<span class="chip c-na">av</span>' : 'ja') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<p class="empty">For prosjektoppgaver betyr «mnd 3» slutten av den tredje måneden etter at prosjektet gikk inn i fasen (som regel mars). For generelle oppgaver er måneden bare et hint.</p>';
  }


  // ---- Page: Innboks --------------------------------------------------------------------------
  function pageInbox() {
    var list = state.d.Innboks.filter(function (i) { return i.sortert !== 'ja'; }).sort(function (a, b) { return a.opprettet < b.opprettet ? 1 : -1; });
    return head('Innboks', 'Raske notater som skal sorteres') +
      '<form class="panel addrow" data-form="inbox"><input type="text" id="inText" placeholder="Skriv noe du vil huske …"><button class="btn primary" type="submit">Legg i innboksen</button></form>' +
      '<section class="panel">' + (list.length ? list.map(function (i) {
        return '<div class="logitem"><div class="d">' + esc(fmtDate(i.opprettet)) + '</div>' + esc(i.tekst) +
          '<div class="addrow"><button class="btn small" data-in-task="' + esc(i.id) + '">Gjør til oppgave</button><button class="btn small" data-in-log="' + esc(i.id) + '">Gjør til logg på prosjekt</button><button class="btn small ghost" data-in-done="' + esc(i.id) + '">Ferdig</button></div></div>';
      }).join('') : '<div class="empty">Innboksen er tom.</div>') + '</section>';
  }


  // ---- Page: Innstillinger ---------------------------------------------------------------------
  function pageSettings() {
    var s = state.d.Innstillinger, theme = store(THEME_KEY) || 'system';
    var guides = {}; try { guides = JSON.parse(s.guider || '{}'); } catch (e) { guides = {}; }
    return head('Innstillinger') +
      '<section class="panel"><h2>Utseende</h2><span class="seg">' + ['system', 'lys', 'mørk'].map(function (t) { return '<button data-theme-set="' + t + '" aria-pressed="' + (theme === t) + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>'; }).join('') + '</span></section>' +
      '<form class="panel" data-form="settings"><h2>Regler</h2><div class="facts">' +
        '<label class="f">Prosjektoppgaver vises (dager før frist)<input type="number" id="sDays" value="' + esc(s.vises_dager_for) + '"></label>' +
        '<label class="f">Nyttårsgjennomgang (MM-DD)<input type="text" id="sReview" value="' + esc(s.gjennomgang_dato) + '"></label>' +
        '<label class="f">Obligatoriske workshops<input type="number" id="sWs" value="' + esc(s.workshops_obligatoriske) + '"></label>' +
        '<label class="f">Mentormøter som kreves<input type="number" id="sMm" value="' + esc(s.mentormoter_kreves) + '"></label>' +
        '<label class="f">Flagg uten kontakt etter (dager)<input type="number" id="sNc" value="' + esc(s.ingen_kontakt_dager) + '"></label>' +
      '</div><div class="addrow"><button class="btn primary" type="submit">Lagre</button></div></form>' +
      '<section class="panel"><h2>Veiledninger <span class="hint">Google Docs</span></h2><div class="hist">' + (Object.keys(guides).length ? Object.keys(guides).map(function (k) { return '<div><a href="' + esc(safeUrl(guides[k])) + '" target="_blank" rel="noopener noreferrer">' + esc(k) + '</a></div>'; }).join('') : 'Ingen ennå (kjør setup i Apps Script).') + '</div></section>' +
      (!(window.google && google.script && google.script.run) ? '<section class="panel"><h2>Denne enheten</h2><button class="btn danger" data-act="forget">Glem nøkkelen på denne enheten</button></section>' : '');
  }


  // ---- Drawer (edit forms) ------------------------------------------------------------------------
  function openDrawer(html, onSubmit) {
    var dr = $('drawer');
    dr.innerHTML = '<form id="drawerForm">' + html + '</form>';
    dr.hidden = false; $('drawerBg').hidden = false;
    var form = $('drawerForm');
    form.addEventListener('submit', function (e) { e.preventDefault(); onSubmit(form); });
    var first = form.querySelector('input,select,textarea'); if (first) first.focus();
  }
  function closeDrawer() { $('drawer').hidden = true; $('drawerBg').hidden = true; $('drawer').innerHTML = ''; }
  function val(form, name) { var el = form.querySelector('[name="' + name + '"]'); return el ? (el.type === 'checkbox' ? (el.checked ? 'ja' : 'nei') : el.value.trim()) : undefined; }
  function field(label, name, value, type, opts) {
    type = type || 'text';
    var input;
    if (type === 'select') input = '<select name="' + name + '">' + opts + '</select>';
    else if (type === 'textarea') input = '<textarea name="' + name + '">' + esc(value) + '</textarea>';
    else input = '<input type="' + type + '" name="' + name + '" value="' + esc(value) + '">';
    return '<label class="f">' + label + input + '</label>';
  }
  function actions(extra) { return '<div class="actions"><span>' + (extra || '') + '</span><span><button type="button" class="btn ghost" data-close>Avbryt</button> <button class="btn primary" type="submit">Lagre</button></span></div>'; }

  // Task editor.
  function editTask(id, preset) {
    var t = id ? byId('Oppgaver', id) : Object.assign({ status: 'Ikke startet', type: 'oppgave', liste: 'Backlog', aar: today().slice(0, 4) }, preset || {});
    if (!t) return;
    var projects = state.d.Prosjekter.filter(function (p) { return p.fase !== 'Arkivert'; }).concat(state.d.Søkere.filter(function (s) { return s.status === 'Aktiv' || !s.status; }));
    var cl = t.sjekkliste ? JSON.parse(t.sjekkliste) : [];
    var step = progressOf(t);
    openDrawer('<h2>' + (id ? 'Oppgave' : 'Ny oppgave') + '</h2>' +
      field('Tittel', 'tittel', t.tittel) +
      '<div class="grid2">' +
        field('Prosjekt', 'prosjekt_id', '', 'select', option('', t.prosjekt_id || '', 'Ingen (generell)') + projects.map(function (p) { return option(p.id, t.prosjekt_id || '', p.kortnavn); }).join('')) +
        field('Type', 'type', '', 'select', option('oppgave', t.type, 'Oppgave') + option('epost', t.type, 'E-post å svare på') + option('notater', t.type, 'Notater til neste gang')) +
        field('Status', 'status', '', 'select', options(STATUSES, t.status)) +
        field('Liste', 'liste', '', 'select', option('', t.liste || '', 'Ingen (følger frist)') + option('Pågående', t.liste || '') + option('Backlog', t.liste || '')) +
        field('Frist', 'frist', t.frist, 'date') +
        field('Fase', 'fase', '', 'select', options(['Søknad', '1. år', '2. år', 'Avslutning', 'Felles'], t.fase || '', '–')) +
        field('Venter på (hvem)', 'venter_paa', t.venter_paa) +
        field('Følg opp', 'oppfolging', t.oppfolging, 'date') +
      '</div>' +
      (cl.length ? '<div class="cl"><span class="group-h">Sjekkliste</span>' + cl.map(function (c, i) { return '<label><input type="checkbox" name="cl' + i + '"' + (c.ferdig ? ' checked' : '') + '> ' + esc(c.tekst) + '</label>'; }).join('') + '</div>' : '') +
      field('Nye punkter i sjekklisten (ett per linje)', 'nycl', '', 'textarea') +
      field('Notat', 'notat', t.notat, 'textarea') +
      (t.opprinnelig_frist && t.opprinnelig_frist !== t.frist ? '<p class="empty">Opprinnelig frist: ' + esc(fmtDate(t.opprinnelig_frist)) + '</p>' : '') +
      (step ? '<p class="empty">Fra Progress: ' + esc(step.tittel) + '</p>' : '') +
      actions(id ? '<button type="button" class="btn danger" data-deltask="' + esc(id) + '">Slett</button>' : ''),
      function (form) {
        var newCl = cl.map(function (c, i) { return { tekst: c.tekst, ferdig: !!form.querySelector('[name="cl' + i + '"]').checked }; });
        (val(form, 'nycl') || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) { newCl.push({ tekst: s, ferdig: false }); });
        var row = { tittel: val(form, 'tittel'), prosjekt_id: val(form, 'prosjekt_id'), type: val(form, 'type'), status: val(form, 'status'), liste: val(form, 'liste'),
          frist: val(form, 'frist'), fase: val(form, 'fase'), venter_paa: val(form, 'venter_paa'), oppfolging: val(form, 'oppfolging'), notat: val(form, 'notat'),
          sjekkliste: newCl.length ? JSON.stringify(newCl) : '' };
        if (!row.tittel) { toast('Skriv en tittel'); return; }
        if (id) row.id = id; else { row.aar = t.aar; row.opprinnelig_frist = row.frist; if (t.progress_id) row.progress_id = t.progress_id; }
        save('Oppgaver', [row]).then(function () { closeDrawer(); toast('Lagret'); render(); });
      });
  }

  // Project editor (new or existing).
  function editProject(id) {
    var p = id ? byId('Prosjekter', id) : { fase: '1. år', forsinket: 'nei', startdato: (Number(today().slice(0, 4)) + 1) + '-01-01' };
    var contacts = state.d.Kontakter;
    openDrawer('<h2>' + (id ? 'Rediger prosjekt' : 'Nytt prosjekt') + '</h2>' +
      '<div class="grid2">' + field('Kortnavn', 'kortnavn', p.kortnavn) + field('Kull (søknadsår)', 'kull', p.kull) + '</div>' +
      field('Full tittel', 'tittel', p.tittel) +
      '<div class="grid2">' + field('Fakultet', 'fakultet', '', 'select', options(FACULTIES, p.fakultet || '', '–')) + field('Institutt/enhet', 'enhet', p.enhet) +
        field('Prosjektleder', 'leder', p.leder) + field('E-post', 'epost', p.epost) +
        field('Startdato', 'startdato', p.startdato, 'date') + field('Planlagt slutt', 'sluttdato', p.sluttdato, 'date') +
        (id ? '' : field('Fase', 'fase', '', 'select', options(ACTIVE, p.fase))) +
        field('Mentor', 'mentor_id', '', 'select', option('', p.mentor_id || '', '–') + contacts.map(function (c) { return option(c.id, p.mentor_id || '', c.navn); }).join('')) +
      '</div>' +
      field('Andre samarbeidspartnere', 'partnere', p.partnere) +
      field('Mål / kort beskrivelse', 'maal', p.maal, 'textarea') +
      field('Merknader', 'merknader', p.merknader, 'textarea') + actions(),
      function (form) {
        var row = {}; ['kortnavn', 'kull', 'tittel', 'fakultet', 'enhet', 'leder', 'epost', 'startdato', 'sluttdato', 'mentor_id', 'partnere', 'maal', 'merknader'].forEach(function (k) { row[k] = val(form, k); });
        if (!row.kortnavn) { toast('Skriv et kortnavn'); return; }
        if (id) { row.id = id; save('Prosjekter', [row]).then(function () { closeDrawer(); toast('Lagret'); render(); }); return; }
        // A new project: save it, then set its phase so the phase's tasks are made.
        var fase = val(form, 'fase');
        row.forsinket = 'nei';
        save('Prosjekter', [row]).then(function (saved) {
          closeDrawer();
          return run('api_setPhase', { id: saved[0].id, fase: fase, dato: row.startdato || today() }, 'Prosjektet er lagt til');
        }).then(function () { location.hash = '#prosjekter'; });
      });
  }

  // Phase change.
  function changePhase(id) {
    var p = byId('Prosjekter', id);
    var next = PHASES[Math.min(PHASES.indexOf(p.fase) + 1, PHASES.length - 1)];
    openDrawer('<h2>Endre fase: ' + esc(p.kortnavn) + '</h2><p class="empty">Nå: ' + esc(p.fase) + '. Oppgavene for den nye fasen lages med frister regnet fra datoen under. Velg «Arkivert» når prosjektet er helt ferdig.</p>' +
      field('Ny fase', 'fase', '', 'select', options(PHASES.slice(1), next)) +
      field('Fra dato', 'dato', next === '2. år' || next === 'Avslutning' ? (Number(today().slice(0, 4)) + (today().slice(5) > '06-30' ? 1 : 0)) + '-01-01' : today(), 'date') + actions(),
      function (form) { closeDrawer(); run('api_setPhase', { id: id, fase: val(form, 'fase'), dato: val(form, 'dato') }, 'Fasen er endret'); });
  }

  // Applicant editor.
  function editApplicant(id) {
    var s = id ? byId('Søkere', id) : { soknadsaar: today().slice(0, 4), steg: STEPS[0], status: 'Aktiv' };
    openDrawer('<h2>' + (id ? esc(s.kortnavn) : 'Ny søker') + '</h2>' +
      '<div class="grid2">' + field('Kortnavn', 'kortnavn', s.kortnavn) + field('Søknadsår', 'soknadsaar', s.soknadsaar) + '</div>' +
      field('Prosjekttittel', 'tittel', s.tittel) +
      '<div class="grid2">' + field('Fakultet', 'fakultet', '', 'select', options(FACULTIES, s.fakultet || '', '–')) + field('Institutt/enhet', 'enhet', s.enhet) +
        field('Prosjektleder', 'leder', s.leder) + field('E-post', 'epost', s.epost) +
        field('Steg', 'steg', '', 'select', options(STEPS, s.steg || STEPS[0])) + field('Status', 'status', '', 'select', options(['Aktiv', 'Opptatt', 'Avslått', 'Trukket'], s.status || 'Aktiv')) + '</div>' +
      field('Merknader', 'merknader', s.merknader, 'textarea') + actions(),
      function (form) {
        var row = {}; ['kortnavn', 'soknadsaar', 'tittel', 'fakultet', 'enhet', 'leder', 'epost', 'steg', 'status', 'merknader'].forEach(function (k) { row[k] = val(form, k); });
        if (!row.kortnavn) { toast('Skriv et kortnavn'); return; }
        if (id) row.id = id;
        save('Søkere', [row]).then(function () { closeDrawer(); toast('Lagret'); if (!id) load(true); else render(); });
      });
  }

  // Admit an applicant.
  function admit(id) {
    var s = byId('Søkere', id);
    openDrawer('<h2>Ta opp ' + esc(s.kortnavn) + '</h2><p class="empty">Søkeren blir et fullt prosjekt i «1. år», med samme notater og oppgaver. Oppgavene for 1. år lages med frister regnet fra startdatoen.</p>' +
      field('Startdato', 'start', (Number(today().slice(0, 4)) + 1) + '-01-01', 'date') +
      '<div class="actions"><span></span><span><button type="button" class="btn ghost" data-close>Avbryt</button> <button class="btn primary" type="submit">Ta opp</button></span></div>',
      function (form) { closeDrawer(); run('api_admit', { id: id, startdato: val(form, 'start') }, s.kortnavn + ' er tatt opp').then(function () { location.hash = '#prosjekt/' + id; }); });
  }

  // Decline or withdraw an applicant.
  function decline(id) {
    var s = byId('Søkere', id);
    openDrawer('<h2>Avslutt ' + esc(s.kortnavn) + '</h2><p class="empty">Søkeren flyttes til «Avsluttet» for dette året. Ingenting slettes.</p>' +
      field('Hva skjedde', 'status', '', 'select', options(['Avslått', 'Trukket'], 'Avslått')) +
      '<div class="actions"><span></span><span><button type="button" class="btn ghost" data-close>Avbryt</button> <button class="btn primary" type="submit">Lagre</button></span></div>',
      function (form) { closeDrawer(); run('api_decline', { id: id, status: val(form, 'status') }, 'Lagret'); });
  }

  // Progress step editor.
  function editStep(id) {
    var s = id ? byId('Progress', id) : { type: 'prosjekt', timing: 'maaned', aktiv: 'ja', flyttes_ved_forsinkelse: 'ja', notater_etter: 'nei', fase: '1. år' };
    openDrawer('<h2>' + (id ? 'Steg i Progress' : 'Nytt steg') + '</h2>' +
      field('Tittel', 'tittel', s.tittel) +
      '<div class="grid2">' +
        field('Fase', 'fase', '', 'select', options(['Søknad', '1. år', '2. år', 'Avslutning', 'Felles'], s.fase)) +
        field('Spor', 'spor', '', 'select', options(['Søknad', 'Pitch', 'Oppstart', 'Kontrakt', 'Utbetaling', 'Rapporter', 'Mentor', 'Intervju', 'Workshop', 'Kommunikasjon', 'Planlegging'], s.spor || '', '–')) +
        field('Type', 'type', '', 'select', option('generell', s.type, 'Generell (én per år, uten frist)') + option('prosjekt', s.type, 'Per prosjekt (med frist)')) +
        field('Frist (prosjektoppgaver)', 'timing', '', 'select', option('maaned', s.timing, 'Slutten av måned N i fasen') + option('dato', s.timing, 'Fast dato (MM-DD)') + option('ingen', s.timing, 'Ingen frist')) +
        field('Måned (1–12)', 'maaned', s.maaned, 'number') + field('Fast dato (MM-DD)', 'dato', s.dato) +
        field('Vises dager før frist (tom = standard)', 'vises_dager_for', s.vises_dager_for, 'number') + field('Rekkefølge', 'rekkefolge', s.rekkefolge, 'number') +
      '</div>' +
      '<label class="check"><input type="checkbox" name="flyttes_ved_forsinkelse"' + (s.flyttes_ved_forsinkelse !== 'nei' ? ' checked' : '') + '> Flyttes når prosjektet utsettes</label>' +
      '<label class="check"><input type="checkbox" name="notater_etter"' + (s.notater_etter === 'ja' ? ' checked' : '') + '> Lag «Notater til neste gang» når den er ferdig</label>' +
      '<label class="check"><input type="checkbox" name="aktiv"' + (s.aktiv !== 'nei' ? ' checked' : '') + '> Aktiv</label>' +
      field('Deloppgaver (én per linje, blir sjekkliste)', 'deloppgaver', s.deloppgaver, 'textarea') +
      field('Lenke til veiledning', 'guide', s.guide) + field('Merknader', 'merknader', s.merknader, 'textarea') +
      '<p class="empty">Endringer gjelder nye oppgaver. Oppgaver som allerede finnes, endres ikke.</p>' + actions(),
      function (form) {
        var row = {}; ['tittel', 'fase', 'spor', 'type', 'timing', 'maaned', 'dato', 'vises_dager_for', 'rekkefolge', 'flyttes_ved_forsinkelse', 'notater_etter', 'aktiv', 'deloppgaver', 'guide', 'merknader'].forEach(function (k) { row[k] = val(form, k); });
        if (!row.tittel) { toast('Skriv en tittel'); return; }
        if (id) row.id = id;
        save('Progress', [row]).then(function () { closeDrawer(); toast('Lagret'); render(); });
      });
  }


  // ---- Clicks, forms and filters -----------------------------------------------------------------
  function setTaskStatus(id, status) {
    var t = byId('Oppgaver', id);
    var next = status || (t.status === 'Ferdig' ? 'Ikke startet' : 'Ferdig');
    var before = state.d.Oppgaver.length;
    save('Oppgaver', [{ id: id, status: next }]).then(function () {
      // Finishing can add a "notes for next time" task on the server: reload then.
      if (next === 'Ferdig' && progressOf(t) && progressOf(t).notater_etter === 'ja') load(true); else render();
      toast(next === 'Ferdig' ? 'Ferdig' : next === 'Pågår' ? 'Påbegynt' : 'Åpnet igjen');
      return before;
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('button, a, tr, [data-task]');
    if (!el) return;
    var ds = el.dataset;
    if (ds.close !== undefined) { closeDrawer(); return; }
    if (ds.go) { e.preventDefault(); location.hash = '#' + ds.go; return; }
    if (ds.done) { setTaskStatus(ds.done); return; }
    if (ds.start) { setTaskStatus(ds.start, 'Pågår'); return; }
    if (ds.task) { editTask(ds.task); return; }
    if (ds.deltask) { closeDrawer(); save('Oppgaver', [], [ds.deltask]).then(function () { toast('Slettet'); render(); }); return; }
    if (ds.deldoc) { save('Dokumenter', [], [ds.deldoc]).then(render); return; }
    if (ds.view) { store(VIEW_KEY, ds.view); render(); return; }
    if (ds.step) { var s = byId('Søkere', ds.step); var i = STEPS.indexOf(s.steg || STEPS[0]); save('Søkere', [{ id: s.id, steg: STEPS[i + 1] }]).then(render); return; }
    if (ds.editApplicant) { editApplicant(ds.editApplicant); return; }
    if (ds.admit) { admit(ds.admit); return; }
    if (ds.decline) { decline(ds.decline); return; }
    if (ds.stepEdit) { editStep(ds.stepEdit); return; }
    if (ds.themeSet) { store(THEME_KEY, ds.themeSet); applyTheme(); render(); return; }
    if (ds.inTask) { var it = byId('Innboks', ds.inTask); editTask(null, { tittel: it.tekst, liste: 'Backlog' }); save('Innboks', [{ id: it.id, sortert: 'ja' }]); return; }
    if (ds.inLog) { inboxToLog(ds.inLog); return; }
    if (ds.inDone) { save('Innboks', [{ id: ds.inDone, sortert: 'ja' }]).then(render); return; }
    switch (ds.act) {
      case 'newtask': editTask(null, ds.project ? { prosjekt_id: ds.project, liste: '' } : null); break;
      case 'newproject': editProject(null); break;
      case 'editproject': editProject(ds.id); break;
      case 'phase': changePhase(ds.id); break;
      case 'newapplicant': editApplicant(null); break;
      case 'newstep': editStep(null); break;
      case 'makegeneral': run('api_makeGeneralTasks', { aar: today().slice(0, 4) }).then(function (n) { toast(n ? n + ' nye generelle oppgaver' : 'Alle finnes allerede'); }); break;
      case 'forget': forget(); break;
    }
  });

  function inboxToLog(id) {
    var it = byId('Innboks', id);
    var projects = state.d.Prosjekter.filter(function (p) { return p.fase !== 'Arkivert'; });
    openDrawer('<h2>Gjør til logg</h2>' + field('Prosjekt', 'pid', '', 'select', projects.map(function (p) { return option(p.id, '', p.kortnavn); }).join('')) +
      field('Tekst', 'tekst', it.tekst, 'textarea') + actions(),
      function (form) {
        save('Logg', [{ prosjekt_id: val(form, 'pid'), dato: today(), type: 'Notat', tekst: val(form, 'tekst') }])
          .then(function () { return save('Innboks', [{ id: id, sortert: 'ja' }]); })
          .then(function () { closeDrawer(); toast('Lagt i loggen'); render(); });
      });
  }

  // Inline forms (log, documents, inbox, settings).
  document.addEventListener('submit', function (e) {
    var f = e.target; if (f.id === 'drawerForm' || f.id === 'connectForm') return;
    e.preventDefault();
    var kind = f.dataset.form;
    if (kind === 'log') { var txt = $('logText').value.trim(); if (!txt) return; save('Logg', [{ prosjekt_id: f.dataset.id, dato: today(), type: $('logType').value, tekst: txt }]).then(render); }
    if (kind === 'doc') { var u = $('docUrl').value.trim(); if (!/^https?:\/\//i.test(u)) { toast('Lenken må starte med https://'); return; } save('Dokumenter', [{ prosjekt_id: f.dataset.id, tittel: $('docTitle').value.trim(), lenke: u }]).then(render); }
    if (kind === 'inbox') { quickAdd($('inText').value); }
    if (kind === 'settings') {
      api('api_saveSettings', { vises_dager_for: $('sDays').value, gjennomgang_dato: $('sReview').value, workshops_obligatoriske: $('sWs').value, mentormoter_kreves: $('sMm').value, ingen_kontakt_dager: $('sNc').value })
        .then(function (s) { state.d.Innstillinger = s; toast('Lagret'); }).catch(fail);
    }
  });

  // Filters: remember the choice and redraw.
  document.addEventListener('change', function (e) {
    var map = { fFase: 'fase', fProsjekt: 'prosjekt', fType: 'type', fDone: 'showDone', fPfase: 'pfase', fKull: 'kull', fFak: 'fak', fDelayed: 'delayed', fSyear: 'syear', fGfase: 'gfase', fGtype: 'gtype' };
    var k = map[e.target.id]; if (!k) return;
    state.filters[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    render();
  });
  document.addEventListener('input', function (e) {
    var map = { fQ: 'q', fPq: 'pq' }; var k = map[e.target.id]; if (!k) return;
    state.filters[k] = e.target.value;
    clearTimeout(state.typing);
    var id = e.target.id;
    state.typing = setTimeout(function () { render(); var el = $(id); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 300);
  });

  // Quick capture from anywhere.
  function quickAdd(text) {
    text = String(text || '').trim(); if (!text) return;
    save('Innboks', [{ tekst: text, opprettet: today(), sortert: 'nei' }]).then(function () { toast('Lagt i innboksen'); closeDrawer(); render(); });
  }
  $('fab').addEventListener('click', function () {
    openDrawer('<h2>Notér raskt</h2>' + field('Hva vil du huske?', 'q', '', 'textarea') + '<div class="actions"><span></span><span><button type="button" class="btn ghost" data-close>Avbryt</button> <button class="btn primary" type="submit">Legg i innboksen</button></span></div>',
      function (form) { quickAdd(val(form, 'q')); });
  });
  $('drawerBg').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('drawer').hidden) closeDrawer(); });


  // ---- Theme ----------------------------------------------------------------------------------------
  function applyTheme() {
    var t = store(THEME_KEY) || 'system';
    if (t === 'lys') document.documentElement.setAttribute('data-theme', 'light');
    else if (t === 'mørk') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }


  // ---- Connect screen ---------------------------------------------------------------------------------
  function validUrl(u) { return /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/.test(u); }
  function showConnect(err) {
    $('shell').hidden = true; $('fab').hidden = true;
    var box = $('connect');
    if (!box.hidden) { if (err) { $('cErr').hidden = false; $('cErr').textContent = err; } return; }
    box.hidden = false;
    $('cUrl').value = store(URL_KEY); $('cKey').value = '';
    $('cErr').hidden = !err; $('cErr').textContent = err || '';
    (store(URL_KEY) ? $('cKey') : $('cUrl')).focus();
  }
  $('connectForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = $('cUrl').value.trim(), key = $('cKey').value.trim();
    if (!validUrl(url)) { $('cErr').hidden = false; $('cErr').textContent = 'Det ser ikke ut som en Apps Script-nettapplenke (https://script.google.com/macros/s/…/exec).'; return; }
    if (!/^[A-Za-z0-9]{32,}$/.test(key)) { $('cErr').hidden = false; $('cErr').textContent = 'Nøkkelen skal være en lang rekke bokstaver og tall.'; return; }
    if (!store(URL_KEY, url) || !store(APP_KEY, key)) { $('cErr').hidden = false; $('cErr').textContent = 'Nettleseren lar ikke siden lagre noe (privat vindu?). Bruk et vanlig vindu.'; return; }
    load(false);
  });
  function forget() {
    openDrawer('<h2>Glem nøkkelen?</h2><p class="empty">Du må skrive inn nøkkelen igjen for å bruke appen på denne enheten.</p><div class="actions"><span></span><span><button type="button" class="btn ghost" data-close>Avbryt</button> <button class="btn primary" type="submit">Glem nøkkelen</button></span></div>',
      function () { store(APP_KEY, null); closeDrawer(); state.d = null; $('main').innerHTML = ''; showConnect('Nøkkelen er fjernet fra denne enheten.'); });
  }


  // ---- Start ----------------------------------------------------------------------------------------------
  applyTheme();
  window.addEventListener('hashchange', route);
  route();
  if ((window.google && google.script && google.script.run) || (store(URL_KEY) && store(APP_KEY))) load(false); else showConnect('');

  // Installable app: the service worker caches the page files only, never your data.
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window.google && google.script)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* works without it */ }); });
  }
})();
