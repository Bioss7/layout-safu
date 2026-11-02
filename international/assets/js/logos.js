document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-partner-network").forEach((root) => {
    if (root.dataset.logosInitialized) return;
    root.dataset.logosInitialized = "true";
    const tracks = [...root.querySelectorAll(".js-partner-track")];
    const updateTracks = () =>
      tracks.forEach((track) => {
        const group = track.querySelector(".js-partner-group");
        if (!group) return;
        const width = group.getBoundingClientRect().width;
        if (!width) return;
        const row = track.closest(".partner-logos__row");
        const offset = Math.abs(parseFloat(getComputedStyle(track.parentElement).left) || 0);
        // На широком экране копии должны закрывать окно даже в конце периода.
        const copies = Math.max(1, Math.ceil((row.clientWidth + offset) / width));
        while (track.children.length > copies + 1) track.lastElementChild.remove();
        while (track.children.length < copies + 1) {
          const copy = group.cloneNode(true);
          copy.classList.remove("js-partner-group");
          copy.setAttribute("aria-hidden", "true");
          copy.inert = true;
          copy.querySelectorAll("a").forEach((link) => {
            link.tabIndex = -1;
          });
          track.append(copy);
        }
        track.style.setProperty("--logo-distance", `${width}px`);
        track.style.setProperty("--logo-duration", `${width / 40}s`);
      });

    // Ширина полного повторяемого набора задаёт длительность для скорости 40 px/с.
    const observer = new ResizeObserver(updateTracks);
    root.querySelectorAll(".js-partner-group").forEach((group) => observer.observe(group));
    root.querySelectorAll(".js-partner-panel").forEach((panel) => observer.observe(panel));
    updateTracks();

    root.addEventListener("pointerover", (event) => {
      if (event.pointerType === "mouse" && event.target.closest(".partner-logos__row")) {
        root.classList.add("partner-network--paused");
      }
    });
    root.addEventListener("pointerout", (event) => {
      if (
        !event.relatedTarget ||
        !root.contains(event.relatedTarget) ||
        !event.relatedTarget.closest(".partner-logos__row")
      ) {
        root.classList.remove("partner-network--paused");
      }
    });
    root.addEventListener("partners:change", () =>
      root.classList.remove("partner-network--paused"),
    );
  });
});
