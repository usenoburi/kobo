// The download links always point at the latest release; this only fills in its version number.
// Without network or when GitHub rate-limits, the badge keeps "Latest · Alpha".
const badge = document.querySelector<HTMLElement>("[data-release-version]");

if (badge) {
  fetch("https://api.github.com/repos/usenoburi/kobo/releases/latest", {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((release: { tag_name?: string } | null) => {
      const version = release?.tag_name?.replace(/^v/, "");
      if (version) badge.textContent = `Version ${version} · Alpha`;
    })
    .catch(() => {});
}
