# Changelog

All notable changes to SPARK-tracker, newest first. Dates are when the version was built.
"Page" = the files in this repository; "back end" = `Kode.gs` in Apps Script.

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
