export const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function page(
  title,
  body,
  headers = new Headers(),
  status = 200,
  formTarget = null,
) {
  headers = new Headers(headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    `default-src 'none'; style-src 'self'; form-action 'self' ${formTarget ? new URL(formTarget).origin : ""}; frame-ancestors 'none'; base-uri 'none'`,
  );
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} — Buff</title><link rel="stylesheet" href="/mcp-ui.css"></head><body><main><a class="brand" href="/">b. <span>buff.</span></a><h1>${escape(title)}</h1>${body}<p class="foot"><a href="/">Back to Buff</a> · <a href="/connections">Connected apps</a></p></main></body></html>`,
    { status, headers },
  );
}
export function signIn(request) {
  const url = new URL(request.url);
  const target = url.pathname + url.search;
  return Response.redirect(
    url.origin + "/?buff_return_to=" + encodeURIComponent(target),
    303,
  );
}
export function sameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}
