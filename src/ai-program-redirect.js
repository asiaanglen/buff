// Older bookmarks open the same in-app chatbot, not a separate builder screen.
const coach = new URL(location.href).searchParams.get("coach") === "1";
location.replace(coach ? "/coach?tab=programs&ai=1" : "/?tab=programs&ai=1");
