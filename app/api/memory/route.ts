import { NextResponse } from "next/server";
import { checkHermesAccess } from "@/lib/hermes/access";
import { getSupabaseClient, getSupabaseErrorMessage } from "@/lib/supabase";

export async function POST(req: Request) {
  const denied = checkHermesAccess(req);

  if (denied) {
    return denied;
  }

  try {
    const body = await req.json();
    const { user_id, content, category } = body;

    const client = getSupabaseClient();

    if (!client) {
      return NextResponse.json({
        success: false,
        error: "Supabase yapılandırılmamış veya kullanılamıyor.",
      });
    }

    const { data, error } = await client
      .from("memory")
      .insert([
        {
          user_id,
          content,
          category: category || "general",
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ success: false, error });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: getSupabaseErrorMessage(err),
    });
  }
}

export async function GET(req: Request) {
  const denied = checkHermesAccess(req);

  if (denied) {
    return denied;
  }

  try {
    const client = getSupabaseClient();

    if (!client) {
      return NextResponse.json({
        success: false,
        error: "Supabase yapılandırılmamış veya kullanılamıyor.",
      });
    }

    const { data, error } = await client
      .from("memory")
      .select("*")
      .eq("user_id", "kemal")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ success: false, error });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: getSupabaseErrorMessage(err),
    });
  }
}
