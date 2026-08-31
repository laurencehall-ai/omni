import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    SF_CALLBACK_URL: process.env.SF_CALLBACK_URL ?? "(not set)",
    NEXT_PUBLIC_CALLBACK_URL: process.env.NEXT_PUBLIC_CALLBACK_URL ?? "(not set)",
  });
}
