import {
  getAccessKeyFromRequest,
  isHermesAccessControlEnabled,
  isValidHermesAccessKey,
} from "@/lib/hermes/access";

export async function POST(req: Request) {
  if (!isHermesAccessControlEnabled()) {
    return Response.json({ success: true, required: false });
  }

  try {
    const body = (await req.json()) as { accessKey?: string };
    const accessKey =
      body.accessKey?.trim() || getAccessKeyFromRequest(req) || "";

    if (!isValidHermesAccessKey(accessKey)) {
      return Response.json(
        {
          success: false,
          message: "Geçersiz erişim anahtarı. Lütfen tekrar deneyin.",
        },
        { status: 401 }
      );
    }

    return Response.json({ success: true, required: true });
  } catch {
    return Response.json(
      {
        success: false,
        message: "Erişim doğrulaması başarısız.",
      },
      { status: 400 }
    );
  }
}
