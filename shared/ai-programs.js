import { exerciseCatalog } from "./exercises.js";
import { validDate, shiftDate } from "./programs.js";
export const AI_MAX_WEEKS = 52;
const text = (value, max, label, empty = false) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    throw Error(`Enter a valid ${label}.`);
  return value.trim();
};
const integer = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max)
    throw Error(`Choose ${label} between ${min} and ${max}.`);
  return value;
};
export function validateBrief(input) {
  if (!input || typeof input !== "object")
    throw Error("Complete the program form.");
  if (!validDate(input.startDate)) throw Error("Choose a valid start date.");
  if (!["beginner", "intermediate", "advanced"].includes(input.experience))
    throw Error("Choose your training experience.");
  return {
    goal: text(input.goal, 300, "goal"),
    experience: input.experience,
    equipment: text(input.equipment, 400, "equipment list"),
    daysPerWeek: integer(input.daysPerWeek, 1, 7, "training days"),
    minutes: integer(input.minutes, 10, 180, "session minutes"),
    weeks: integer(input.weeks, 1, AI_MAX_WEEKS, "program weeks"),
    startDate: input.startDate,
    preferences: text(input.preferences || "", 1000, "preferences", true),
    useHistory: input.useHistory === true,
  };
}
export function aiCatalog(state) {
  return [
    ...exerciseCatalog.map((e) => ({ ...e, key: "public:" + e.id })),
    ...(state.customExercises || []).map((e) => ({
      ...e,
      custom: true,
      category: "Personal",
      equipment: "User-defined",
      key: "personal:" + e.id,
    })),
  ];
}
export function aiHistory(state, definitions) {
  const history = new Map();
  for (const w of [...state.workouts].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    for (const e of w.exercises) {
      const definition = definitions.find((d) =>
        d.custom
          ? d.id === e.customExerciseId
          : d.id === e.libraryId ||
            d.name.toLowerCase() === e.name.toLowerCase(),
      );
      if (!definition || history.has(definition.key)) continue;
      const log = [...e.logs]
        .reverse()
        .find(
          (l) =>
            l.done &&
            l.weight !== "" &&
            Number.isFinite(Number(l.weight)) &&
            l.actual !== "",
        );
      if (log)
        history.set(definition.key, {
          exercise_id: definition.key,
          weight_lbs: Number(log.weight),
          actual: Number(log.actual),
          mode: e.mode,
        });
      if (history.size === 30) return [...history.values()];
    }
  }
  return [...history.values()];
}
export const draftTool = {
  name: "submit_program_draft",
  description:
    "Return a proposed new Buff program for the user's preview. This does not save or enroll a program. Use only exercise IDs from the provided catalog. Use reusable templates and numbered weeks to keep the response compact.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "name",
      "summary",
      "start_date",
      "weeks_count",
      "templates",
      "weeks",
      "explanation",
    ],
    properties: {
      name: { type: "string", maxLength: 100 },
      summary: { type: "string", maxLength: 350 },
      explanation: { type: "string", maxLength: 1500 },
      start_date: {
        type: "string",
        description:
          "YYYY-MM-DD. Preserve the user's start date unless they request a change.",
      },
      weeks_count: { type: "integer", minimum: 1, maximum: 52 },
      templates: {
        type: "array",
        minItems: 1,
        maxItems: 14,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "note", "exercises"],
          properties: {
            id: { type: "string", maxLength: 30 },
            name: { type: "string", maxLength: 100 },
            note: { type: "string", maxLength: 200 },
            exercises: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "exercise_id",
                  "sets",
                  "target",
                  "weight_lbs",
                  "superset",
                ],
                properties: {
                  exercise_id: { type: "string" },
                  sets: { type: "integer", minimum: 1, maximum: 8 },
                  target: { type: "integer", minimum: 1, maximum: 3600 },
                  weight_lbs: { type: "number", minimum: 0, maximum: 5000 },
                  superset: { type: "string", maxLength: 12 },
                },
              },
            },
          },
        },
      },
      weeks: {
        type: "array",
        minItems: 1,
        maxItems: 52,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["week", "note", "days"],
          properties: {
            week: { type: "integer", minimum: 1, maximum: 52 },
            note: {
              type: "string",
              maxLength: 280,
              description:
                "Progression cues for this week, including how to choose or adjust load.",
            },
            days: {
              type: "array",
              minItems: 1,
              maxItems: 7,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["day", "template_id"],
                properties: {
                  day: {
                    type: "integer",
                    minimum: 1,
                    maximum: 7,
                    description:
                      "Offset from this program week's start: day 1 is the chosen start date, not necessarily Monday.",
                  },
                  template_id: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};
export function normalizeAiDraft(
  plan,
  brief,
  definitions,
  history = [],
  initial = false,
) {
  if (!plan || typeof plan !== "object")
    throw Error("Claude did not return a program draft.");
  const name = text(plan.name, 100, "program name"),
    summary = text(plan.summary, 350, "program summary");
  text(plan.explanation, 1500, "explanation");
  const weeks = integer(plan.weeks_count, 1, AI_MAX_WEEKS, "program weeks");
  if (!validDate(plan.start_date))
    throw Error("The proposed start date is invalid.");
  if (initial && (weeks !== brief.weeks || plan.start_date !== brief.startDate))
    throw Error(
      "The draft does not match your requested duration or start date.",
    );
  if (
    !Array.isArray(plan.templates) ||
    plan.templates.length < 1 ||
    plan.templates.length > 14 ||
    !Array.isArray(plan.weeks) ||
    plan.weeks.length !== weeks
  )
    throw Error("The draft needs templates and every numbered week.");
  const templates = new Map();
  for (const template of plan.templates) {
    const id = text(template.id, 30, "template ID");
    if (templates.has(id)) throw Error("Duplicate workout template.");
    if (
      !Array.isArray(template.exercises) ||
      !template.exercises.length ||
      template.exercises.length > 10
    )
      throw Error("Each workout needs 1–10 exercises.");
    templates.set(id, {
      name: text(template.name, 100, "workout name"),
      note: text(template.note, 200, "workout notes", true),
      exercises: template.exercises.map((e) => {
        const definition = definitions.find((d) => d.key === e.exercise_id);
        if (!definition)
          throw Error("The draft included an exercise outside your library.");
        const sets = integer(e.sets, 1, 8, "sets"),
          target = integer(
            e.target,
            1,
            definition.mode === "time" ? 3600 : 100,
            "reps or seconds",
          );
        if (
          typeof e.weight_lbs !== "number" ||
          !Number.isFinite(e.weight_lbs) ||
          e.weight_lbs < 0 ||
          e.weight_lbs > 5000
        )
          throw Error("The proposed weight is invalid.");
        const previous = history.find(
          (h) => h.exercise_id === e.exercise_id && h.mode === definition.mode,
        );
        const weight =
          definition.weighted === false || !brief.useHistory || !previous
            ? 0
            : Math.min(
                e.weight_lbs,
                Math.round((previous.weight_lbs * 1.1 + 5) * 100) / 100,
              );
        return {
          name: definition.name,
          sets,
          target,
          mode: definition.mode,
          weighted:
            definition.weighted ?? definition.equipment !== "Bodyweight",
          weight,
          group: text(e.superset, 12, "superset group", true),
          ...(definition.custom
            ? {
                instructions: definition.instructions,
                weighted: definition.weighted,
              }
            : {}),
        };
      }),
    });
  }
  const seenWeeks = new Set(),
    workouts = [];
  for (const week of plan.weeks) {
    integer(week.week, 1, weeks, "week");
    if (seenWeeks.has(week.week)) throw Error("A week was repeated.");
    seenWeeks.add(week.week);
    const note = text(week.note, 280, "weekly guidance", true);
    if (
      !Array.isArray(week.days) ||
      !week.days.length ||
      week.days.length > 7 ||
      (initial && week.days.length !== brief.daysPerWeek)
    )
      throw Error("The weekly training schedule does not match your request.");
    const seenDays = new Set();
    for (const day of week.days) {
      integer(day.day, 1, 7, "workout day");
      if (seenDays.has(day.day)) throw Error("A training day was repeated.");
      seenDays.add(day.day);
      const template = templates.get(day.template_id);
      if (!template) throw Error("A scheduled workout template is missing.");
      workouts.push({
        ...structuredClone(template),
        offset: (week.week - 1) * 7 + day.day - 1,
        note: [template.note, note].filter(Boolean).join("\n").slice(0, 500),
      });
    }
  }
  const loadNote = brief.useHistory
    ? "Starting weights are suggestions only where recent completed weights exist; choose a comfortable load for other exercises."
    : "Starting weights are unassigned. Choose a comfortable load you can perform with good form.";
  const snapshot = {
    version: 1,
    program: {
      name,
      weeks,
      note: [summary, loadNote].join("\n").slice(0, 500),
    },
    workouts: workouts.sort((a, b) => a.offset - b.offset),
  };
  if (!validDate(shiftDate(plan.start_date, weeks * 7 - 1)))
    throw Error("The program dates are outside the supported range.");
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 850000)
    throw Error("This program is too large. Try fewer weeks or workouts.");
  return {
    snapshot,
    startDate: plan.start_date,
    explanation: plan.explanation,
  };
}
