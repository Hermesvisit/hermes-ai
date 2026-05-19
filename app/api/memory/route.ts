import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, content, category } = body;

    const { data, error } = await supabase
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("memory")
      .select("*")
      .eq("user_id", "kemal")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ success: false, error });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}