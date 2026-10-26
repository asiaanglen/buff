import { weekStart } from "./model.js";
import {
  csvRows,
  parseProgramRows,
  validateXlsxArchive,
  appendImportedProgram,
} from "./program-import.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function createProgramImporter({ getState, commit }) {
  const root = document.createElement("div");
  root.id = "import-root";
  document.body.append(root);
  let sheets = [],
    selected = 0,
    parsed = null,
    reading = 0;
  function open() {
    sheets = [];
    parsed = null;
    selected = 0;
    root.innerHTML = `<div class="modal-backdrop"><section class="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div class="modal-header"><div><div class="eyebrow">YOUR PLAN, READY TO TRAIN</div><h2 id="import-title">Import a workout program</h2></div><button class="icon-button close" data-import="close" aria-label="Close import">×</button></div><p class="field-help">Upload CSV or Excel (.xlsx). Each row is one exercise. <a href="/buff-program-template.csv" download>Download the CSV template</a>; Excel can open and save it as .xlsx.</p><label>Program file<input name="programFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><div id="import-sheet"></div><form id="program-import-form"><label>Program name<input name="name" required maxlength="100" placeholder="e.g. 10-week strength build"></label><div class="form-grid"><label>Number of weeks<input name="weeks" type="number" required min="1" max="5200" value="4"></label><label>Start date<input name="startDate" type="date" required value="${weekStart()}"></label></div><p class="field-help">Required columns: week, exercise, sets, and reps or seconds. Optional: day (1–7), workout, weight (kg), superset, workout_notes. Days count from each program week’s start.</p><div id="import-preview" aria-live="polite"><p>Select a file to preview it. Existing workouts will be kept.</p></div><p class="form-error" role="alert"></p><div class="modal-footer"><span class="autosave">Read locally in your browser</span><button class="button primary" type="submit" disabled>Import program →</button></div></form></section></div>`;
    root.querySelector("[name=programFile]").focus();
  }
  function preview() {
    const form = root.querySelector("form");
    if (!form || !sheets.length) return;
    const options = Object.fromEntries(new FormData(form));
    parsed = parseProgramRows(sheets[selected].data, options);
    const box = root.querySelector("#import-preview");
    if (parsed.errors.length) {
      box.innerHTML = `<div class="import-errors"><strong>Fix these issues before importing</strong><ul>${parsed.errors
        .slice(0, 25)
        .map((e) => `<li>${esc(e)}</li>`)
        .join(
          "",
        )}</ul>${parsed.errors.length > 25 ? `<p>${parsed.errors.length - 25} more issues.</p>` : ""}</div>`;
    } else {
      const byWeek = new Map();
      for (const w of parsed.workouts) {
        const n =
          Math.floor(
            (Date.parse(w.date) - Date.parse(parsed.program.startDate)) /
              604800000,
          ) + 1;
        byWeek.set(n, (byWeek.get(n) || 0) + 1);
      }
      box.innerHTML = `<div class="import-summary"><strong>${parsed.program.weeks} weeks · ${parsed.workouts.length} workouts · ${parsed.exerciseCount} exercises</strong><p>${[...byWeek].map(([n, c]) => `Week ${n}: ${c} workout${c === 1 ? "" : "s"}`).join(" · ")}</p></div><div class="import-preview-rows">${parsed.workouts.map((w) => `<div><strong>${esc(w.name)}</strong><small>${w.date} · ${w.exercises.length} exercises</small><p>${w.exercises.map((e) => `${esc(e.name)} — ${e.sets} × ${e.target} ${e.mode === "time" ? "sec" : "reps"}${e.group ? ` (superset ${esc(e.group)})` : ""}`).join("<br>")}</p></div>`).join("")}</div>`;
    }
    form.querySelector("[type=submit]").disabled = parsed.errors.length > 0;
    form.querySelector(".form-error").textContent = "";
  }
  root.addEventListener("change", async (event) => {
    if (event.target.name === "programFile") {
      const file = event.target.files[0],
        job = ++reading;
      parsed = null;
      sheets = [];
      root.querySelector("[type=submit]").disabled = true;
      if (!file) return;
      const error = root.querySelector(".form-error");
      error.textContent = "Reading file…";
      try {
        if (file.size > 5 * 1024 * 1024)
          throw Error("Choose a file up to 5 MB.");
        let loaded;
        if (/\.csv$/i.test(file.name))
          loaded = [{ sheet: "CSV", data: csvRows(await file.text()) }];
        else if (/\.xlsx$/i.test(file.name)) {
          const buffer = await file.arrayBuffer();
          validateXlsxArchive(buffer);
          const { default: readExcel } =
            await import("read-excel-file/browser");
          loaded = await readExcel(buffer);
        } else throw Error("Choose a .csv or .xlsx file.");
        if (job !== reading || !root.querySelector("form")) return;
        sheets = loaded;
        if (!sheets.length) throw Error("The file contains no sheets.");
        selected = 0;
        root.querySelector("#import-sheet").innerHTML =
          sheets.length > 1
            ? `<label>Workbook sheet<select name="sheet">${sheets.map((s, i) => `<option value="${i}">${esc(s.sheet)}</option>`).join("")}</select></label>`
            : "";
        const form = root.querySelector("form");
        if (!form.elements.name.value)
          form.elements.name.value = file.name
            .replace(/\.(csv|xlsx)$/i, "")
            .slice(0, 100);
        const inferred = parseProgramRows(sheets[0].data, {
          name: form.elements.name.value,
          startDate: form.elements.startDate.value,
        });
        if (inferred.inferredWeeks)
          form.elements.weeks.value = Math.min(5200, inferred.inferredWeeks);
        preview();
      } catch (e) {
        if (job === reading && root.querySelector(".form-error"))
          root.querySelector(".form-error").textContent =
            e.message || "The file could not be read.";
      }
      return;
    }
    if (event.target.name === "sheet") {
      selected = Number(event.target.value);
      const form = root.querySelector("form");
      const inferred = parseProgramRows(sheets[selected].data, {
        name: form.elements.name.value,
        startDate: form.elements.startDate.value,
      });
      if (inferred.inferredWeeks)
        form.elements.weeks.value = inferred.inferredWeeks;
      preview();
    } else preview();
  });
  root.addEventListener("input", (event) => {
    if (event.target.form?.id === "program-import-form") preview();
  });
  root.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    preview();
    try {
      const next = appendImportedProgram(getState(), parsed);
      commit(next, parsed.program.id);
      close();
    } catch (e) {
      root.querySelector(".form-error").textContent = e.message;
    }
  });
  function close() {
    reading++;
    root.innerHTML = "";
    sheets = [];
    parsed = null;
  }
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-import=close]")) close();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const list = [
        ...root.querySelectorAll("button:not([disabled]),input,select,a"),
      ];
      const first = list[0],
        last = list.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  return { open };
}
