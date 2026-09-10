"use client";
import Chart from "./Chart";
import { formatNumber } from "@/lib/format";
import type { PlatformView, TrendPoint } from "@/lib/metrics";

/**
 * The daily-reach curve on the insights screen. Chart takes a formatter
 * function, and functions can't cross from a server component into a client
 * one, so this thin client wrapper owns the formatter and takes only data.
 */
export default function ReachChart({
  points,
  markers,
  minSpan,
}: {
  points: TrendPoint[];
  markers: PlatformView["published"];
  minSpan: number;
}) {
  return (
    <Chart
      points={points}
      label="contas alcançadas por dia"
      format={(n) => formatNumber(n)}
      markers={markers}
      color="var(--g1)"
      minSpan={minSpan}
      floor={0}
    />
  );
}
