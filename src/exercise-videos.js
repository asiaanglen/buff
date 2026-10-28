import { libraryExerciseVideo } from "../shared/exercise-videos.js";
import { youtubeId, youtubeUrl, videoKey } from "../shared/youtube.js";
export function exerciseVideoButton(name, esc) {
  return `<button type="button" class="text-button exercise-video-button" data-exercise-video="${esc(name)}"><span aria-hidden="true">▷</span> YouTube demonstration</button>`;
}
export function setupExerciseVideos({ getState, save, esc }) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exercise-video]");
    if (!button) return;
    const name = button.dataset.exerciseVideo;
    const key = videoKey(name);
    const state = getState();
    const personal = state.customExercises?.find(
      (e) => videoKey(e.name) === key,
    );
    const library = libraryExerciseVideo(name);
    const existing =
      state.exerciseVideos?.[key] ||
      personal?.videoUrl ||
      state.workouts
        .flatMap((w) => w.exercises)
        .find((e) => videoKey(e.name) === key && e.videoUrl)?.videoUrl ||
      library?.url ||
      "";
    document.querySelector("#exercise-video-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "exercise-video-dialog";
    dialog.className = "exercise-guide-dialog exercise-video-dialog";
    dialog.setAttribute("aria-labelledby", "exercise-video-title");
    dialog.innerHTML = `<div class="eyebrow">EXERCISE DEMONSTRATION</div><h2 id="exercise-video-title">${esc(name)}</h2><div class="exercise-video-player"></div>${library ? `<p class="video-source">Library demonstration: ${esc(library.title)}${library.creator ? ` · ${esc(library.creator)}` : ""}</p>` : ""}<p class="video-variation" hidden></p><p>Choose a demonstration that matches this exercise and equipment.</p><p><a class="button subtle" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/results?search_query=${encodeURIComponent(name + " proper form exercise tutorial")}">Find a video on YouTube ↗</a></p><form><label>YouTube video link<input name="videoUrl" type="url" maxlength="1000" placeholder="https://www.youtube.com/watch?v=…" value="${esc(existing)}"></label><small>Paste a video’s share link to save it for this exercise. This choice is private to your account. Clear the link to use the library default.</small><p class="form-error" role="alert"></p><button class="button primary" type="submit">Save video</button></form><p class="video-privacy">YouTube loads only when you choose Play. Videos may contain ads or be unavailable; you can always open them on YouTube.</p><button type="button" class="button subtle" data-video-close>Close video</button>`;
    const player = dialog.querySelector(".exercise-video-player");
    const showVideo = (url) => {
      const id = youtubeId(url);
      const credit = dialog.querySelector(".video-source");
      if (credit)
        credit.textContent =
          library && id === youtubeId(library.url)
            ? `Library demonstration: ${library.title}${library.creator ? ` · ${library.creator}` : ""}`
            : "Your saved video";
      const variation = dialog.querySelector(".video-variation");
      if (variation) {
        variation.textContent =
          library && id === youtubeId(library.url) ? library.note || "" : "";
        variation.hidden = !variation.textContent;
      }
      player.replaceChildren();
      if (!id) return;
      const play = document.createElement("button");
      play.type = "button";
      play.className = "button primary video-play";
      play.textContent = "▷ Play demonstration";
      play.onclick = () => {
        const frame = document.createElement("iframe");
        frame.src = `https://www.youtube-nocookie.com/embed/${id}`;
        frame.title = `${name} demonstration`;
        frame.allow = "encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        play.replaceWith(frame);
      };
      const external = document.createElement("a");
      external.href = youtubeUrl(url);
      external.target = "_blank";
      external.rel = "noopener noreferrer";
      external.className = "text-button";
      external.textContent = "Open on YouTube ↗";
      player.append(play, external);
    };
    showVideo(existing);
    dialog.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      const input = event.target.elements.videoUrl;
      const url = youtubeUrl(input.value);
      const error = dialog.querySelector(".form-error");
      if (input.value.trim() && !url) {
        error.textContent =
          "Enter a YouTube video link (watch, Shorts, or youtu.be).";
        return;
      }
      const current = getState();
      const videos = { ...(current.exerciseVideos || {}) };
      if (url) videos[key] = url;
      else delete videos[key];
      if (Object.keys(videos).length > 1000) {
        error.textContent = "Your saved video library is full.";
        return;
      }
      const next = { ...current, exerciseVideos: videos };
      if (new TextEncoder().encode(JSON.stringify(next)).length > 1024 * 1024) {
        error.textContent =
          "Your journal is full. Download a backup before making room.";
        return;
      }
      current.exerciseVideos = videos;
      if (!url) {
        const definition = current.customExercises?.find(
          (e) => videoKey(e.name) === key,
        );
        if (definition) delete definition.videoUrl;
        for (const workout of current.workouts)
          for (const exercise of workout.exercises) {
            if (videoKey(exercise.name) === key) delete exercise.videoUrl;
          }
      }
      save();
      input.value = url || "";
      showVideo(url || library?.url);
      error.textContent = url
        ? "Video saved. Tap Play to watch."
        : "Using the library demonstration.";
    };
    dialog.querySelector("[data-video-close]").onclick = () => dialog.close();
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}
