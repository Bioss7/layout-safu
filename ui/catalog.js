import pages from "./data/pages.json";

const catalog = document.querySelector(".js-catalog");
pages.forEach((page) => {
  const card = document.createElement("article");
  card.className = "catalog__card";
  const heading = document.createElement("h2");
  const link = document.createElement("a");
  link.href = page.url;
  link.textContent = page.name;
  heading.append(link);
  const status = document.createElement("p");
  status.textContent = page.status;
  card.append(heading, status);
  if (page.design) {
    const design = document.createElement("a");
    design.href = page.design;
    design.textContent = "Макет Figma";
    card.append(design);
  } else {
    const text = document.createElement("p");
    text.textContent = "Ссылка на макет: нет данных";
    card.append(text);
  }
  catalog.append(card);
});

try {
  const response = await fetch(document.documentElement.dataset.remarksUrl || "/__ui/remarks");
  if (!response.ok) throw new Error();
  const remarks = await response.json();
  document.querySelector(".js-remarks-status").textContent = `Замечаний: ${remarks.length}`;
  remarks.forEach((remark) => {
    const item = document.createElement("li");
    // Данные поступают из единого JSON-реестра; textContent не выполняет их как HTML.
    item.textContent = `${remark.text} (${remark.file}:${remark.line})`;
    document.querySelector(".js-remarks").append(item);
  });
} catch {
  document.querySelector(".js-remarks-status").textContent =
    "Не удалось загрузить JSON-реестр замечаний. Проверьте pnpm project:data:check и доступность локального preview.";
}
