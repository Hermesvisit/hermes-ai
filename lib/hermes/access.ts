import { timingSafeEqual } from "crypto";

export const HERMES_ACCESS_HEADER = "x-hermes-access-key";

export function isHermesAccessControlEnabled(): boolean {
  return Boolean(process.env.HERMES_ACCESS_KEY?.trim());
}

function getExpectedAccessKey(): string | null {
  const key = process.env.HERMES_ACCESS_KEY?.trim();
  return key || null;
}

function safeEqualStrings(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function isValidHermesAccessKey(provided: string | null | undefined): boolean {
  const expected = getExpectedAccessKey();

  if (!expected) {
    return true;
  }

  if (!provided?.trim()) {
    return false;
  }

  return safeEqualStrings(provided.trim(), expected);
}

export function getAccessKeyFromRequest(req: Request): string | null {
  const headerKey = req.headers.get(HERMES_ACCESS_HEADER)?.trim();

  if (headerKey) {
    return headerKey;
  }

  const authorization = req.headers.get("authorization")?.trim();

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  try {
    const queryKey = new URL(req.url).searchParams.get("access_key")?.trim();

    if (queryKey) {
      return queryKey;
    }
  } catch {
    // ignore invalid URL
  }

  return null;
}

export function unauthorizedHermesResponse(): Response {
  return Response.json(
    {
      success: false,
      message:
        "Erişim reddedildi. Geçerli Hermes erişim anahtarı gerekli.",
    },
    { status: 401 }
  );
}

/** Returns a 401 Response when access control is enabled and the key is invalid. */
export function checkHermesAccess(req: Request): Response | null {
  if (!isHermesAccessControlEnabled()) {
    return null;
  }

  if (!isValidHermesAccessKey(getAccessKeyFromRequest(req))) {
    return unauthorizedHermesResponse();
  }

  return null;
}
