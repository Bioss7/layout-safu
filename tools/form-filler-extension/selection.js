(() => {
  const app = globalThis.__safuFiller;
  function create(host, announce) {
    let cancel = null;
    function pick({
      area = false,
      container = false,
      message = "Укажите элемент. ↑ — родитель, ↓ — обратно, Enter — выбрать, Escape — отмена.",
    } = {}) {
      cancel?.();
      announce(message);
      return new Promise((resolve, reject) => {
        const marker = document.createElement("div");
        marker.style.cssText =
          "position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #21765e;background:#21a57a20;box-sizing:border-box;";
        document.documentElement.append(marker);
        let current = null;
        let hovered = null;
        const ancestors = [];
        let start = null;
        const inside = (event) => event.composedPath().includes(host);
        function cleanup() {
          for (const [name, handler] of Object.entries(handlers))
            document.removeEventListener(name, handler, true);
          marker.remove();
          cancel = null;
        }
        function finish(value) {
          cleanup();
          resolve(value);
        }
        function abort() {
          cleanup();
          reject(new Error("Выбор отменён"));
        }
        cancel = abort;
        function draw(rect) {
          Object.assign(marker.style, {
            left: rect.left + "px",
            top: rect.top + "px",
            width: rect.width + "px",
            height: rect.height + "px",
          });
        }
        const handlers = {
          pointermove(event) {
            if (inside(event)) return;
            if (area && start) {
              draw({
                left: Math.min(start.x, event.clientX),
                top: Math.min(start.y, event.clientY),
                width: Math.abs(start.x - event.clientX),
                height: Math.abs(start.y - event.clientY),
              });
            } else if (!area) {
              const node = event.target;
              if (node === hovered) return;
              hovered = node;
              ancestors.length = 0;
              current = container
                ? node.closest('form, fieldset, [role="form"], section, article') || node
                : node;
              draw(current.getBoundingClientRect());
            }
          },
          pointerdown(event) {
            if (inside(event) || event.button !== 0) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (area) start = { x: event.clientX, y: event.clientY };
          },
          pointerup(event) {
            if (inside(event) || !area || !start) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const rect = {
              left: Math.min(start.x, event.clientX) + scrollX,
              top: Math.min(start.y, event.clientY) + scrollY,
              right: Math.max(start.x, event.clientX) + scrollX,
              bottom: Math.max(start.y, event.clientY) + scrollY,
            };
            if (rect.right - rect.left < 5 || rect.bottom - rect.top < 5) return;
            // Поглощаем завершающий click, чтобы выделение не активировало поле страницы.
            finish({ area: rect });
            document.addEventListener(
              "click",
              (click) => {
                click.preventDefault();
                click.stopImmediatePropagation();
              },
              { capture: true, once: true },
            );
          },
          click(event) {
            if (inside(event)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (area) return;
            const node =
              current && (current.contains(event.target) || current === event.target)
                ? current
                : container
                  ? event.target.closest('form, fieldset, [role="form"], section, article') ||
                    event.target
                  : event.target;
            finish(container ? { root: node } : node);
          },
          keydown(event) {
            if (!area && current && ["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              event.preventDefault();
              event.stopImmediatePropagation();
              if (event.key === "Enter") {
                finish(container ? { root: current } : current);
                return;
              }
              if (event.key === "ArrowUp" && current.parentElement) {
                ancestors.push(current);
                current = current.parentElement;
              }
              if (event.key === "ArrowDown" && ancestors.length) current = ancestors.pop();
              draw(current.getBoundingClientRect());
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopImmediatePropagation();
              abort();
            }
          },
          pointercancel() {
            abort();
          },
        };
        for (const [name, handler] of Object.entries(handlers))
          document.addEventListener(name, handler, true);
      });
    }
    function highlight(nodes) {
      const markers = nodes.filter(app.dom.visible).map((node) => {
        const el = document.createElement("div");
        const rect = node.getBoundingClientRect();
        el.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #21765e;background:#21a57a20;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;box-sizing:border-box`;
        document.documentElement.append(el);
        return el;
      });
      return () => markers.forEach((marker) => marker.remove());
    }
    return { pick, highlight, cancel: () => cancel?.() };
  }
  app.selection = { create };
})();
