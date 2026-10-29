export function brandLogo(coach = false) {
  const classic = coach
    ? "b. <span>buff.</span>"
    : '<span class="brand-icon">b.</span>buff<span class="brand-dot">.</span>';
  return `<span class="brand-classic">${classic}</span><img class="brand-muscle-mami" src="/images/muscle-mami-logo.png" alt="Buff" width="1918" height="820" loading="lazy" decoding="async">`;
}
