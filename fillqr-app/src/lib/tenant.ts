const RESERVED_SUBDOMAINS = ["app", "www", "admin", "xpgad", "demo", "api"];

function getBaseDomain(): string {
  return process.env.BASE_DOMAIN ?? "fillqr.de";
}

export function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const baseDomain = getBaseDomain().toLowerCase();

  if (!hostname.endsWith(`.${baseDomain}`)) {
    return null;
  }

  const sub = hostname.slice(0, -(baseDomain.length + 1));
  if (!sub || sub.includes(".")) {
    return null;
  }

  return sub;
}

export function isAppDomain(host: string): boolean {
  return extractSubdomain(host) === "app";
}

export function isReserved(slug: string): boolean {
  return RESERVED_SUBDOMAINS.includes(slug.toLowerCase());
}
