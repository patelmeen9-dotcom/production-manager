"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PRODUCT_COLORS = [
  "var(--accent)",
  "var(--on-time)",
  "var(--warn)",
  "#64748b",
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#db2777",
];

export function ClientProductChart(props: {
  data: Record<string, string | number>[];
  productKeys: string[];
}) {
  if (props.data.length === 0 || props.productKeys.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-faint">
        No finished-goods entries in this date range.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, props.data.length * 36)}>
      <BarChart data={props.data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10.5, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
        <YAxis
          dataKey="client"
          type="category"
          width={100}
          tick={{ fontSize: 11.5, fill: "var(--ink)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid var(--line)",
            borderRadius: 4,
            background: "var(--panel)",
            color: "var(--ink)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {props.productKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="products"
            name={key}
            fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
            radius={index === props.productKeys.length - 1 ? [0, 2, 2, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProcessOutputChart(props: {
  data: { processName: string; quantity: number }[];
}) {
  if (props.data.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-faint">No process entries in this date range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={props.data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="processName"
          tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
          axisLine={{ stroke: "var(--line-strong)" }}
          tickLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={56}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid var(--line)",
            borderRadius: 4,
            background: "var(--panel)",
            color: "var(--ink)",
          }}
        />
        <Bar dataKey="quantity" name="Units completed" fill="var(--accent)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StagePipelineChart(props: {
  data: { processName: string; cumulative: number; sitting: number }[];
}) {
  if (props.data.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-faint">No stage progress in the current filter.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="processName"
          tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
          axisLine={{ stroke: "var(--line-strong)" }}
          tickLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={56}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid var(--line)",
            borderRadius: 4,
            background: "var(--panel)",
            color: "var(--ink)",
          }}
        />
        <Bar dataKey="cumulative" name="Completed at stage" fill="var(--on-time)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="sitting" name="Waiting before stage" fill="var(--warn)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
