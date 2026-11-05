export const aiBrief = {
  goal: "Build strength",
  experience: "beginner",
  equipment: "Full gym",
  daysPerWeek: 3,
  minutes: 45,
  weeks: 2,
  startDate: "2026-11-09",
  preferences: "Keep sessions balanced.",
  useHistory: false,
};
export function aiPlan(name = "AI strength block") {
  return {
    name,
    summary: "A balanced program with a gradual progression.",
    start_date: aiBrief.startDate,
    weeks_count: 2,
    explanation:
      "I built a balanced draft. Review the weekly plan and tell me what you’d like to change.",
    templates: [
      {
        id: "strength",
        name: "Strength session",
        note: "Choose comfortable loads and leave two reps in reserve.",
        exercises: [
          {
            exercise_id: "public:back-squat",
            sets: 3,
            target: 8,
            weight_lbs: 95,
            superset: "A",
          },
          {
            exercise_id: "public:plank",
            sets: 2,
            target: 30,
            weight_lbs: 0,
            superset: "A",
          },
        ],
      },
    ],
    weeks: [1, 2].map((week) => ({
      week,
      note:
        week === 1
          ? "Build a comfortable baseline."
          : "Add a rep when all sets feel comfortable.",
      days: [1, 3, 5].map((day) => ({ day, template_id: "strength" })),
    })),
  };
}
