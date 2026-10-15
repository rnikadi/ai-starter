import { NextResponse } from "next/server";
import process from "node:process";
import { appConfig } from "@/lib/app-config";

export async function GET() {
  const memory = process.memoryUsage();
  return NextResponse.json({
    status: "healthy",
    service: `${appConfig.packageName}-frontend`,
    uptimeSeconds: Math.round(process.uptime() * 10) / 10,
    timestamp: new Date().toISOString(),
    node: process.version,
    memory: {
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 10) / 10,
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 10) / 10,
    },
  });
}

