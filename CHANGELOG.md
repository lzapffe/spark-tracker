# Changelog

All notable changes to SPARK-tracker, newest first. Dates are when the version was built.
"Page" = the files in this repository; "back end" = `Kode.gs` in Apps Script.

## v14 – 10 November 2026

### Added
- **Alternatives (◆, purple chip).** When a project does something else instead of an activity, it counts as taken part, but is shown differently:
  - **Alternativ til** in the activity form (Rediger): tick the activities this one replaces, e.g. "Eget mentormøte" as an alternative to Mentormøte 2. Projects marked Deltatt there count as having taken part in Mentormøte 2.
  - **Alternativ** in "Hvem var med?" on an activity year: choose the activity year that was done instead from a list, or write it yourself (or both). "endre" changes it, "Fjern alternativet" removes it.
  - Shown as "◆ Vært med (alternativ: …)" in "Har de aktive prosjektene vært med?", and as "◆ 1 alternativ" under the Workshops and Mentormøter counts on the project page. Both count towards the required number.
- **Milestone reached through an alternative:** "Via alternativ" next to "Merk som nådd": choose an activity year or write what was done. It counts as reached and shows "◆ Nådd (alternativ)" with the text; the year view in Årsplan shows "(◆ 1)".

- **E-post page** (Mer → E-post, was E-postmaler) with two tabs:
  - **Maler:** all templates in one place (general, invitations, per type and per activity), with search and a filter for general, invitations, a type or an activity.
  - **Mottakere:** a recipient list to copy into Outlook, as `Navn <epost>; …`. Main choices: all active projects, 1st-year, 2nd-year, all applicants this year. **Flere valg:** year group, faculty, application round, applicant status, an activity year (påmeldt or deltatt), project people by role, and contacts and people by tag. When the chosen projects have contact persons, a notice asks whether to add them in To, in Kopi, or ignore them. Kopier buttons, a list of people without e-mail, and Nullstill.
- **Personer** on the project page (was the contacts panel): name, organisation, e-mail, role (Prosjektmedarbeider, Prosjektkoordinator, Samarbeidspartner, Annet), tags and **Kontaktperson** (included when you e-mail the project leader). Tap a person to edit.
- **Tags** on people and on Kontakter, from a fixed list with suggestions (Innstillinger → Tagger); a new tag typed in a form is added to the list.

### Back end
- New columns: `Serier.alternativ_til`, `Deltakelse.alternativ` and `via_runde_id` (status `Alternativ`), `Milepaelstatus.alternativ` and `via_runde_id`, `Kontakter.tagger`. New setting `tagger`. Run `setup` once.

## v13 – 9 November 2026

### Added
- **Shared task lists per type** ("Felles oppgaver: Alle mentormøter", "Alle pitcher" …): a button on the activity page. Every new year of every activity of that type gets these tasks first, marked **felles**, then the activity's own. A title in both lists is made once.
- **Agenda variants** on the activity page and the activity year: one variant per size (e.g. "Opptil 10" and "11–14 prosjekter"), chosen by a yearly number (prosjekter, søkere or one you type; set per activity with "Agendaen velges etter antall"). Each variant is a table (time, length, what) with a coloured time bar (Innhold, Pitch, Pause, Diskusjon). The year page shows the variant that fits this year's number first (typed on the year, else the projects signed up or the applicants that year); the buttons show the others, and "Bruk denne i <år>" picks one by hand. All variants are kept.
- **Experiences (Erfaringer)** with **Skriv erfaring** on the activity page and the year page: the experience, why, and what it is pinned to (an agenda row, a task, a delmål, a file, an e-mail template, or the activity in general). It is shown next to that thing ("Erfaring 2025: … why"), newest first, two at a time. Ticking "Endre agendaen også" / "Endre oppgavelisten også" changes the minutes or text of the agenda row, or the days or name of the task in the list, and the change is saved with the experience. ✕ hides one; "Alle erfaringer" on the activity page lists them all and can show hidden ones again.
- **Dokumenter og e-postmaler** panel: **faste filer** (follow the activity every year), **årets filer** (one year), and the activity's e-mail templates plus the ones shared by its type (chip "felles for …"), each with "Åpne i e-post". The template form has "Eller felles for en type".
- **Delmål board** on an activity year: one column per delmål with a progress bar, "x/y", the days before or after the date for each task, 🔒 "etter «…»", the "felles" chip and experiences.

### Changed
- **No hint text next to panel headings** (Linn's rule for SPARK). Text inside the panels and empty-state text stay. Navigation links in headings (alle, alle milepæler, årsoversikt) stay. Counts that were in the hints (e.g. "x av y ferdig", "+3 mnd totalt") are hidden too.
- The year page order is now Agenda, Oppgaver, Dokumenter og e-postmaler, then Hvem var med, Notater, Til denne aktiviteten (invites, general templates, guides, budget), Utgifter and Generell info. The activity's own templates moved from "Til denne aktiviteten" to the new documents panel; "Se flyten i Arbeidsflyt" is now "Rediger som arbeidsflyt" above the board.

### Back end
- New tabs `Typemaler` (`type`, `oppgavemal`), `Agendaer` (`serie_id`, `navn`, `fra`, `til`, `rader` JSON `[{id, min, hva, art}]`, `merknad`, `rekkefolge`) and `Erfaringer` (`serie_id`, `runde_id`, `aar`, `tekst`, `hvorfor`, `fest_til`, `endring`, `skjult`, `opprettet`), all in `EDITABLE_TABS`.
- New columns: `Serier.agenda_faktor`, `Runder.antall`, `Runder.variant`, `Dokumenter.serie_id`, `Dokumenter.runde_id`, `Maler.serie_type`, `Oppgaver.felles`. Run `setup` once.
- `makeRunTasks_` reads the type's shared list first and marks those tasks `felles` = ja.
- `api_getData` reads a tab that does not exist yet as empty, so the page works before `setup` has been run.

## v12 – 9 November 2026

### Changed
- **Arrangementer is now Aktiviteter.** Each activity has an **art**: *arrangement* (one day, e.g. a workshop) or *prosess* (a period, e.g. Ny utlysning, Første søknadsrunde). The list page shows the two in separate sections. A process year has a start and an end date (Fra / Til) and no "Hvem var med?".
- **Oppstartsmøte and Workshop 1** are two separate activities (new sheets; `migrateV12` adds Oppstartsmøte to an existing sheet).
- **Årsplan** shows month names (Slutten av januar) instead of month numbers, and the step form has a month drop-down.
- The postpone button on a project is now **Utsett prosjektet**.
- **Salary: extra days count like normal workdays** (× 7.5 h × stillingsprosent), not as a whole 7.5 h day. Wording: "ekstra dager" instead of "ekstra SPARK-dager".

### Added
- **Task lists with order:** a third part `etter: A, B` in the activity's task list locks the task until A and B (same year) are done.
- **E-mail templates linked to an activity:** "Knyttet til aktivitet" in the template form. The activity year's panel (**Til denne aktiviteten**) shows its own templates first, then the general ones, and has "+ E-postmal for <activity>".
- **Se flyten i Arbeidsflyt** on an activity year: its tasks as a flow.
- New activities: Ny utlysning, Første søknadsrunde, Intervjuer, Sluttrapporter (processes).
- **Milepæler (goals), separate from tasks.** Each goal has a month: either per project in its 1st or 2nd year or in Avslutning (e.g. "Mentor på plass", end of March, 1. år; reached when the project's tasks with Gjelder "Mentor" are done), or for the program each year (e.g. "Utlysningen er ute", June; reached when the tasks from its Årsplan steps and/or its activity are done). Turn off "automatisk" to tick by hand only; any goal can be ticked by hand. Shown on the project page (per year, "x av y"), in **Årsplan** as a year view January–December ("3 av 5 prosjekter"; tap for the list and the tick buttons; ← → for other years; + Milepæl), and on **Oversikt** when this year's goal month has passed. A first list of 17 goals (Claude's draft from the year plan, approved by Linn).
- **Delmål in an activity's task list:** a heading with its own deadline, and the tasks below it. Reached when its tasks are done, or ticked by hand ("Kryss av selv"). The activity year shows the tasks grouped under each delmål with "x av y ferdig". A task's form has a Delmål field on activity years.
- **Task list editor:** the activity's task list is now a list with fields (name, ± days, "Etter" with one or more tasks ticked (all must be done first), delmål headings, + Delmål / + Oppgave / ↑ ↓ ✕). "Vis som tekst" shows the text form (`# Delmål | dager | manuelt`, `Oppgave | dager | etter: A, B`).
- Finding mentors ("Finn forslag til mentorer", "Finn mentor til prosjektet") is now in **1. år**; mentor meetings stay in 2. år.

### Back end
- New columns: `Serier.art`, `Runder.sluttdato`, `Maler.serie_id`. Run `setup`, then `migrateV12` once.- New columns: `Serier.art`, `Runder.sluttdato`, `Maler.serie_id`. Run `setup`, then `migrateV12` once.
- `makeRunTasks_` reads `etter:` and fills `laases_opp_av` with the task IDs.
- `seriesTrack_` knows the new types (Oppstart, Utlysning, Søknad, Rapport).
- New tabs `Milepaeler` (the goals) and `Milepaelstatus` (hand ticks), new columns `Oppgaver.delmaal` and `Runder.delmaal_ferdig`. `makeRunTasks_` reads `#` lines. `seedMilestones_` makes the first 17 goals. `migrateV12` also moves the two mentor steps to 1. år and fills in the goals' activity links.

## v11 – 9 November 2026

### Added
- **Kontaktpersoner** on the project page: the project leader plus extra contact people (name, e-mail, role). Tick "Alltid på kopi" for the ones who should always be copied in.
- **E-post til prosjektet** in the same panel: a new e-mail or one of the general templates, addressed to the project leader with the "always on copy" people as cc, and the leader's name and the project filled in.

### Changed
- **New project form:** choosing Kull sets the start date to 1 January that year; the start date sets the planned end to two years later (the day before: 1 Jan 2026 → 31 Dec 2027). Only empty or automatically filled dates are changed.

### Back end
- Prosjekter: new column `kontakter`. Run `setup` once to add it.

## v10 – 9 November 2026

### Changed
- **Numbers with spaces:** amounts, hours and chart/KPI numbers are shown as 10 000 instead of 10000 (`fmtNum`; a non-breaking space, so a number never wraps). Amount fields are text boxes that show the spaces and save the plain number; the "Få refusjon" task title too (back end `krText_`).

### Removed
- The button "Fyll inn arbeidsdager" in the salary form. The month boxes already open with the workdays (weekdays minus public holidays) for a new year, or with what you saved last; changes you don't save are dropped when you close the form.

## v9 – 9 November 2026

### Changed
- **Salary in Budsjett:** the month numbers are now whole workdays, not SPARK days. SPARK hours = workdays × 7.5 h × stillingsprosent (20 %), plus 7.5 h per extra whole SPARK day. Cost = hours × hourly rate (yearly salary at 100 % / 1950 h, or your own rate). "Fyll inn arbeidsdager" fills in Mon–Fri minus Norwegian public holidays; holidays (ferie) are taken out by hand. Each month tile has − / + for workdays and for extra SPARK days.
- **Gjennomgang ved årsskiftet → Budsjett for <year>:** one form for the whole year: salary, the year's project money (shown, worked out by itself), a rough planned amount for each active event series, and other posts (this year's, last year's to copy, and three empty lines for new ones).

- **Hendelser is now called Arrangementer** and is in the top menu. **Progress is now called Årsplan** in the app (the sheet tab keeps the name Progress).
- **Kull** in the project form is a drop-down: 2013 to four years from now, this year to begin with.

### Added
- **Task list for an event series** (Rediger on the series): one task per line, "title | days before (−) or after (+) the date". Every new year of the event gets these tasks; their deadlines follow the event date. "Lag oppgaver fra listen" on an event year adds any that are missing.
- **Til dette arrangementet** on an event year: invite a speaker, invite a mentor (mentor meetings), the general e-mail templates filled in with the event, guides, the budget post and the task list in one place.
- **Slett året** in the event-year form (asks first; done tasks and expenses are kept).

### Removed
- Hint texts: "forfalt, oppfølging, denne uka" (Haster), the one beside "Budsjett for <year>", "frist nå eller forfalt" and "uten frist, alltid her" (Oppgaver), "opptatt, avslått, trukket" (Søkere), "uten frist", "synlige nå" and "f.eks. workshops" (phase pages), "frist denne måneden, og generelle som pleier å komme nå" (month view).

### Back end
- Budsjett: new columns `arbeidsdager_plan`, `arbeidsdager`, `ekstra`, `timesats` (`dager`, `dager_plan`, `dagsats` are no longer used). Serier: `oppgavemal`. Oppgaver: `mal_dager`. Run `setup` once to add them.
- New calls `api_runTasks`, `api_deleteRun`; `api_newRun` makes the year's tasks; saving an event year moves the deadlines of its list tasks.

## v8 – 8 November 2026

### Added
- **Plan og faktisk** on each project page: one row per checkpoint (and each event the project takes part in), with the original plan (dashed) and now (solid) on the same row, joined by a bar, and a "+x mnd" / "i rute" column. Zoom: Alt, Per fase, 1 år, 6 mnd, 3 mnd, 4 uker. Colour = type (Kontrakt, Utbetaling, Rapporter, Intervjuer, Arrangementer, Mentor); a tick means done and a red ring means overdue.
- **Tidslinje for alle** (button on Prosjekter): one row per milestone, x axis in months since each project's start, one dashed plan dot and one dot per project (solid = reached, open = not yet). All projects are shown (each can be hidden with its name button) in 12 colours that repeat after 12. Hovering a dot or a name, or tapping a dot on the phone, highlights that project and fades the others.
- **Tasks that unlock other tasks:** "Låses opp av" in the task form and the Progress step form, and a new page **Mer → Arbeidsflyt** to build chains (+ Neste), branches (+ Gren) and joins ("Ny oppgave etter alle valgte"). Locked tasks are hidden from Oppgaver, Haster, Ukentlig gjennomgang, the phase pages and the month view, and show greyed out with a lock on the project page. A "Vis låste" tick box on Oppgaver, the phase pages and the month view shows them there too. A deadline can count from the unlock day ("x dager etter") or be a fixed date.
- **Mer → Statistikk:** charts per year and year over year: applicants (per faculty and how far they got), admitted and admission rate, active projects per phase, delays (count, average months, reasons), milestones on time, workshops held and attendance, mentor meetings held vs required, tasks done per month. Tap a bar to see the exact numbers.
- **Mer → Budsjett:** the whole SPARK budget per year in one table, headings Lønn, Prosjektmidler, Arrangementer and Annet, a subtotal per heading and a total. Lønn: stillingsprosent (default 20 %) spread into SPARK days per month, 12 month tiles with − / +, day rate = yearly salary / 260 (editable). Prosjektmidler worked out: 400 000 kr per project in its start year and the year after (setting), paid when the task "Utbetaling år N" is Ferdig or marked paid by hand. Arrangementer: a rough planned amount per post; actual = the expense lines. Expenses have a paid date; "Lagt ut selv" makes a "Få refusjon" task, and the refunded date and that task follow each other. New step in Gjennomgang ved årsskiftet.
- **E-mail templates** in Norwegian and English: "Inviter foredragsholder" on a workshop year and "Inviter mentor" on a project page fill in name, event, date, time and place (plus project and description for mentors), with **Åpne i e-post** (mailto) and **Kopier**. **Mer → E-postmaler** lists all templates, including general ones that open a draft in one click. Templates are first drafts, editable in the app.
- Event years have a time field (Klokkeslett).
- New sheet tabs: Budsjett (types lonn, post, utbetaling), Utgifter (with `utlegg`, `refundert_dato`, `oppgave_id`), Maler. New settings `prosjektmidler_per_aar`, `stilling_spark`, `refusjon_dager`. New columns: Progress `laases_opp_av`, `frist_dager`; Oppgaver `laases_opp_av`, `frist_dager`, `laast_opp`; Runder `tid`.
- `migrateV8()` (run once by hand): fills in a missing original deadline from the current deadline.
- Documentation: this changelog, README, docs/workflow.md and one explanation file per code file in docs/code/.

### Changed
- The back end sends the full list of phase changes (`Fasehistorikk`) with the data, for the statistics.
- Saving a task now re-checks which tasks are locked or unlocked. Saving a task or an expense keeps refund tasks and refunded dates in step (`refreshRefunds_`).
- CSV download includes the new tabs.

## v7 – 8 November 2026

### Added
- **Ukentlig gjennomgang** (button on Oppgaver and Oversikt): done this week, not finished (move to next week, postpone, done), next week (deadlines, quiet projects, add a task), a note for the week and "Ferdig med uka", saved in Historikk.

## v6 – 8 November 2026

### Changed
- More natural Norwegian on every label and button (from the word list).
- Per-project **checkpoints** ("Status for prosjektet", field "Gjelder") replace the old "spor".
- The Oversikt grid is split into one table per phase, with a "Fra tidligere" column.
- The status "Pågår" became "Pågående", and the separate Pågående list was merged into it.
- "Runde" became "År"; mentor meetings became two arrangements, Mentormøte 1 and 2.
- `migrateV6()` updated the existing data once.

## v5 – 6 November 2026

### Added
- The weekly backup also copies the guide Docs and the export Docs, in a dated folder (8 kept).
- "Last ned alt": one zip with the sheet as Excel and all Docs as Word.

## v4 – 6 November 2026

### Changed
- Menu moved to the top (Faser ▾ and Mer ▾ drop-downs), and a new dark mode "Salvie og kobber".

## v1–v3 – 6 November 2026

### Added
- First version, built in five steps: the Google Sheet and back end with the year plan (Progress), the page on GitHub Pages with an app key, projects, applicants, tasks, phases, month and year view, events, the new-year review, postponing, status, knowledge base, search, Doc exports and the weekly backup.
