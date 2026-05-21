import { isHermesAccessControlEnabled } from "@/lib/hermes/access";

export async function GET() {
  return Response.json({
    required: isHermesAccessControlEnabled(),
  });
}
