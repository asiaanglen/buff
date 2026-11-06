// Deliberately limited Markdown: no raw HTML, links, images, or executable markup.
const escapeText = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const inline = (value) =>
  escapeText(value).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

export function formatAiMessage(value) {
  const blocks = [];
  let paragraph = [],
    items = [],
    listType = null,
    start = 1;
  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (items.length)
      blocks.push(
        `<${listType}${listType === "ol" && start !== 1 ? ` start="${start}"` : ""}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${listType}>`,
      );
    items = [];
    listType = null;
  };
  for (const raw of String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")) {
    const line = raw.trim();
    const match = line.match(/^(?:(\d{1,4})[.)]|([-*]))\s+(.+)$/);
    if (match) {
      flushParagraph();
      const type = match[1] ? "ol" : "ul";
      if (listType !== type) {
        flushList();
        start = Number(match[1] || 1);
      }
      listType = type;
      items.push(match[3]);
    } else {
      flushList();
      if (!line) flushParagraph();
      else if (/^#{1,6}\s+/.test(line)) {
        flushParagraph();
        blocks.push(
          `<p><strong>${inline(line.replace(/^#{1,6}\s+/, ""))}</strong></p>`,
        );
      } else paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}
