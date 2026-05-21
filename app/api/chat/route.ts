import { checkHermesAccess } from "@/lib/hermes/access";
import { handleHermesMessage } from "@/lib/hermes/router";

export async function POST(req: Request) {
  const denied = checkHermesAccess(req);

  if (denied) {
    return denied;
  }

  try {
    const body = await req.json();

    const message = body.message || "";
    const selectedPersona = body.persona || "Karışık Düşünme";
    const selectedMode = body.mode || "Hibrit";

    if (!message.trim()) {
      return Response.json(
        {
          success: false,
          message: "Boş mesaj gönderildi.",
        },
        { status: 400 }
      );
    }

    const result = await handleHermesMessage({
      message,
      selectedPersona,
      selectedMode,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          "Hermes tarafında hata var: " +
          (error instanceof Error ? error.message : "bilinmeyen hata"),
      },
      { status: 500 }
    );
  }
}