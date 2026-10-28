document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-partner-network").forEach((root) => {
    if (root.dataset.logosInitialized) return;
    root.dataset.logosInitialized = "true";
    const tracks = [...root.querySelectorAll(".js-partner-track")];
    tracks.forEach((track) => {
      const group = track.querySelector(".js-partner-group");
      if (!group) return;
      const copy = group.cloneNode(true);
      copy.classList.remove("js-partner-group");
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      copy.querySelectorAll("a").forEach((link) => {
        link.tabIndex = -1;
      });
      track.append(copy);
    });

    // Ширина полного повторяемого набора задаёт длительность для скорости 40 px/с.
    const observer = new ResizeObserver((entries) => {
      entries.forEach(({ target }) => {
        const width = target.getBoundingClientRect().width;
        if (width) target.parentElement.style.setProperty("--logo-duration", `${width / 40}s`);
      });
    });
    root.querySelectorAll(".js-partner-group").forEach((group) => observer.observe(group));

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
