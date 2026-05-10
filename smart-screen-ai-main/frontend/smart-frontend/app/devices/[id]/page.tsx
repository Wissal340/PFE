"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  createWebSocket,
  getAiHistory,
  getAlerts,
  getDevice,
  getLatestMetric,
  getMetrics,
} from "../../../lib/api";
import BroadcastStudio from "./components/BroadcastStudio";

type Device = {
  id: string;
  name: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
};

type Metric = {
  id: number;
  device_id: string;
  cpu: number;
  ram: number;
  temp?: number | null;
  vlc_running: boolean;
  timestamp: string;
};

type Alert = {
  id: number;
  device_id: string;
  type: string;
  message: string;
  value?: number | null;
  threshold?: number | null;
  created_at: string;
};

type AiPrediction = {
  id: number;
  device_id: string;
  cpu: number;
  ram: number;
  temp: number;
  vlc_running: boolean;
  anomaly_score: number;
  prediction: "normal" | "warning" | "critical" | "unknown";
  reason: string;
  created_at: string;
};

type ChartPoint = {
  time: string;
  cpu: number;
  ram: number;
  temp: number;
};

type AiChartPoint = {
  time: string;
  score: number;
};

type AiState = {
  status: "normal" | "warning" | "critical";
  score: number;
  reason: string;
  updatedAt?: string | null;
};

type VisualState = {
  status: "normal" | "black_screen" | "frozen" | "display_error";
  reason: string;
  updatedAt?: string | null;
};

type ComplianceState = {
  status: "unknown" | "compliant" | "partially_compliant" | "non_compliant";
  reason: string;
  updatedAt?: string | null;
};

function MetricCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="group rounded-3xl border border-slate-800 bg-[#111827]/95 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-50">
        {value}
      </p>
      {subValue && <p className="mt-2 text-xs text-slate-500">{subValue}</p>}
      <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-70 transition group-hover:w-24" />
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0f172a] p-3 shadow-2xl">
      <p className="mb-2 text-xs font-medium text-slate-400">{label}</p>
      <div className="space-y-1 text-sm">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="text-slate-200">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function getAiStatus(alerts: Alert[], aiHistory: AiPrediction[]): AiState {
  const latestPrediction = aiHistory[0];
  if (latestPrediction) {
    const status =
      latestPrediction.prediction === "critical"
        ? "critical"
        : latestPrediction.prediction === "warning"
          ? "warning"
          : "normal";

    return {
      status,
      score: Number(latestPrediction.anomaly_score ?? 0),
      reason: latestPrediction.reason || "Analyse AI disponible",
      updatedAt: latestPrediction.created_at,
    };
  }

  const latestAiAlert = alerts.find((alert) => alert.type === "AI");
  if (!latestAiAlert) {
    return {
      status: "normal",
      score: 0,
      reason: "Aucune anomalie détectée",
      updatedAt: null,
    };
  }

  const score = Number(latestAiAlert.value ?? 0);

  if (score >= 0.75) {
    return {
      status: "critical",
      score,
      reason: latestAiAlert.message,
      updatedAt: latestAiAlert.created_at,
    };
  }

  if (score >= 0.45) {
    return {
      status: "warning",
      score,
      reason: latestAiAlert.message,
      updatedAt: latestAiAlert.created_at,
    };
  }

  return {
    status: "normal",
    score,
    reason: latestAiAlert.message,
    updatedAt: latestAiAlert.created_at,
  };
}

function getVisualStatus(alerts: Alert[]): VisualState {
  const visualAlert = alerts.find((alert) => alert.type === "VISUAL");

  if (!visualAlert) {
    return {
      status: "normal",
      reason: "Aucune anomalie visuelle détectée",
      updatedAt: null,
    };
  }

  const msg = visualAlert.message.toLowerCase();

  if (msg.includes("black_screen")) {
    return {
      status: "black_screen",
      reason: visualAlert.message,
      updatedAt: visualAlert.created_at,
    };
  }

  if (msg.includes("frozen")) {
    return {
      status: "frozen",
      reason: visualAlert.message,
      updatedAt: visualAlert.created_at,
    };
  }

  if (msg.includes("display_error")) {
    return {
      status: "display_error",
      reason: visualAlert.message,
      updatedAt: visualAlert.created_at,
    };
  }

  return {
    status: "normal",
    reason: visualAlert.message,
    updatedAt: visualAlert.created_at,
  };
}

function getComplianceStatus(alerts: Alert[]): ComplianceState {
  const complianceAlert = alerts.find((alert) => alert.type === "COMPLIANCE");

  if (!complianceAlert) {
    return {
      status: "compliant",
      reason: "Aucune non-conformité détectée",
      updatedAt: null,
    };
  }

  return {
    status: "non_compliant",
    reason: complianceAlert.message,
    updatedAt: complianceAlert.created_at,
  };
}

function getAiBadgeClass(status: AiState["status"]) {
  if (status === "critical") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }
  if (status === "warning") {
    return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  }
  return "border-green-500/30 bg-green-500/15 text-green-300";
}

function getVisualBadgeClass(status: VisualState["status"]) {
  if (status === "black_screen") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }
  if (status === "frozen") {
    return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  }
  if (status === "display_error") {
    return "border-violet-500/30 bg-violet-500/15 text-violet-300";
  }
  return "border-green-500/30 bg-green-500/15 text-green-300";
}

function getComplianceBadgeClass(status: ComplianceState["status"]) {
  if (status === "non_compliant") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }
  if (status === "partially_compliant") {
    return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  }
  return "border-green-500/30 bg-green-500/15 text-green-300";
}

function getAlertBadge(type: string) {
  if (type === "CPU")
    return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  if (type === "TEMP") return "border-red-500/30 bg-red-500/15 text-red-300";
  if (type === "VLC")
    return "border-violet-500/30 bg-violet-500/15 text-violet-300";
  if (type === "AI") return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
  if (type === "VISUAL")
    return "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300";
  if (type === "COMPLIANCE")
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  return "border-slate-600 bg-slate-700/40 text-slate-300";
}

function getPredictionBadge(prediction: AiPrediction["prediction"]) {
  if (prediction === "critical") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }
  if (prediction === "warning") {
    return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  }
  if (prediction === "normal") {
    return "border-green-500/30 bg-green-500/15 text-green-300";
  }
  return "border-slate-600 bg-slate-700/40 text-slate-300";
}

export default function DeviceDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [latestMetric, setLatestMetric] = useState<Metric | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [aiHistory, setAiHistory] = useState<AiPrediction[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [aiChartData, setAiChartData] = useState<AiChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveStatus, setLiveStatus] = useState("");
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllAi, setShowAllAi] = useState(false);

  async function loadData() {
    if (!id) return;

    try {
      setError("");

      const [deviceData, latestData, metricsData, alertsData, aiData] =
        await Promise.all([
          getDevice(id),
          getLatestMetric(id).catch(() => null),
          getMetrics(id, 20).catch(() => []),
          getAlerts(id).catch(() => []),
          getAiHistory(id, 30).catch(() => []),
        ]);

      const currentDevice = (deviceData as Device | null) || null;
      const latest = (latestData as Metric | null) || null;
      const metricsList = Array.isArray(metricsData)
        ? (metricsData as Metric[])
        : [];
      const alertsList = Array.isArray(alertsData)
        ? (alertsData as Alert[])
        : [];
      const aiList = Array.isArray(aiData) ? (aiData as AiPrediction[]) : [];

      setDevice(currentDevice);
      setLatestMetric(latest);
      setMetrics(metricsList);
      setAlerts(alertsList);
      setAiHistory(aiList);

      const sortedMetrics = [...metricsList].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      setChartData(
        sortedMetrics.map((m) => ({
          time: new Date(m.timestamp).toLocaleTimeString(),
          cpu: m.cpu,
          ram: m.ram,
          temp: m.temp ?? 0,
        })),
      );

      const sortedAi = [...aiList].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      setAiChartData(
        sortedAi.map((item) => ({
          time: new Date(item.created_at).toLocaleTimeString(),
          score: Number(item.anomaly_score ?? 0),
        })),
      );
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les détails du device");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const socket = createWebSocket((message) => {
      if (message?.type === "metric_created") {
        const payload = message.payload;
        if (payload.device_id !== id) return;

        const newMetric: Metric = {
          id: payload.id ?? Date.now(),
          device_id: payload.device_id,
          cpu: payload.cpu,
          ram: payload.ram,
          temp: payload.temp,
          vlc_running: payload.vlc_running,
          timestamp: payload.timestamp,
        };

        setLatestMetric(newMetric);
        setMetrics((prev) => [newMetric, ...prev].slice(0, 20));

        setChartData((prev) => [
          ...prev.slice(-19),
          {
            time: new Date(payload.timestamp).toLocaleTimeString(),
            cpu: payload.cpu,
            ram: payload.ram,
            temp: payload.temp ?? 0,
          },
        ]);

        if (payload.ai) {
          const newAi: AiPrediction = {
            id: Date.now(),
            device_id: payload.device_id,
            cpu: payload.cpu,
            ram: payload.ram,
            temp: payload.temp ?? 0,
            vlc_running: payload.vlc_running,
            anomaly_score: Number(payload.ai.anomaly_score ?? 0),
            prediction: payload.ai.prediction ?? "unknown",
            reason: payload.ai.reason ?? "AI unavailable",
            created_at: payload.ai.created_at ?? new Date().toISOString(),
          };

          setAiHistory((prev) => [newAi, ...prev].slice(0, 30));
          setAiChartData((prev) => [
            ...prev.slice(-29),
            {
              time: new Date(newAi.created_at).toLocaleTimeString(),
              score: Number(newAi.anomaly_score ?? 0),
            },
          ]);
        }

        setLiveStatus("Nouvelle métrique reçue");
        setTimeout(() => setLiveStatus(""), 2500);
      }

      if (message?.type === "alert_created") {
        const payload = message.payload;
        if (payload.device_id !== id) return;

        const newAlert: Alert = {
          id: payload.id,
          device_id: payload.device_id,
          type: payload.type,
          message: payload.message,
          value: payload.value,
          threshold: payload.threshold,
          created_at: payload.created_at,
        };

        setAlerts((prev) => [newAlert, ...prev]);

        setLiveStatus(`Nouvelle alerte: ${payload.type}`);
        setTimeout(() => setLiveStatus(""), 3000);
      }
    });

    return () => {
      socket.close();
    };
  }, [id]);

  const isOnline = useMemo(() => device?.status === "online", [device]);
  const aiState = useMemo(
    () => getAiStatus(alerts, aiHistory),
    [alerts, aiHistory],
  );
  const visualState = useMemo(() => getVisualStatus(alerts), [alerts]);
  const complianceState = useMemo(() => getComplianceStatus(alerts), [alerts]);

  const visibleMetrics = showAllMetrics ? metrics : metrics.slice(0, 5);
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);
  const visibleAi = showAllAi ? aiHistory : aiHistory.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] px-6 py-8 text-slate-100">
        <div className="rounded-3xl border border-slate-800 bg-[#111827] p-6 shadow-xl">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                    <span className="text-lg font-bold text-blue-300">S</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-50">
                      Smart Screen AI
                    </div>
                    <div className="text-xs text-slate-400">
                      Device supervision dashboard
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/devices/${id}/player`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Ouvrir simulation écran
                  </Link>

                  <Link
                    href="/devices"
                    className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    Retour devices
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Device details
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    {device?.name || "Unknown Screen"}
                  </h1>

                  <p className="mt-3 text-base text-slate-300">
                    {device?.location || "Sans localisation"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 xl:w-[860px]">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-blue-300">
                      Statut live
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {isOnline ? "Actif" : "Inactif"}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${getAiBadgeClass(aiState.status)}`}
                  >
                    <div className="text-xs uppercase tracking-wide">AI</div>
                    <div className="mt-2 text-xl font-semibold capitalize text-white">
                      {aiState.status}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${getVisualBadgeClass(visualState.status)}`}
                  >
                    <div className="text-xs uppercase tracking-wide">
                      Visual
                    </div>
                    <div className="mt-2 text-xl font-semibold capitalize text-white">
                      {visualState.status}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 ${getComplianceBadgeClass(complianceState.status)}`}
                  >
                    <div className="text-xs uppercase tracking-wide">
                      Compliance
                    </div>
                    <div className="mt-2 text-xl font-semibold capitalize text-white">
                      {complianceState.status}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {liveStatus && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-200 shadow-lg">
              {liveStatus}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 shadow-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="CPU Usage"
              value={latestMetric ? `${latestMetric.cpu}%` : "-"}
              subValue="Usage processeur"
            />
            <MetricCard
              label="RAM Usage"
              value={latestMetric ? `${latestMetric.ram}%` : "-"}
              subValue="Utilisation mémoire"
            />
            <MetricCard
              label="Température"
              value={
                latestMetric?.temp != null ? `${latestMetric.temp}°C` : "-"
              }
              subValue="Capteur thermique"
            />
            <MetricCard
              label="VLC Status"
              value={
                latestMetric
                  ? latestMetric.vlc_running
                    ? "Running"
                    : "Stopped"
                  : "-"
              }
              subValue="État du player"
            />
            <MetricCard
              label="AI Score"
              value={aiState.score.toFixed(2)}
              subValue="Analyse intelligente"
            />
            <MetricCard
              label="Conformité"
              value={complianceState.status}
              subValue="Diffusion réelle"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Analyse AI"
              right={
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAiBadgeClass(aiState.status)}`}
                >
                  {aiState.status}
                </span>
              }
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                  <b className="text-white">Score:</b>{" "}
                  {aiState.score.toFixed(2)}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                  <b className="text-white">Reason:</b> {aiState.reason}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Analyse visuelle"
              right={
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getVisualBadgeClass(visualState.status)}`}
                >
                  {visualState.status}
                </span>
              }
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                  <b className="text-white">Status:</b> {visualState.status}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                  <b className="text-white">Reason:</b> {visualState.reason}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Conformité diffusion"
              right={
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getComplianceBadgeClass(complianceState.status)}`}
                >
                  {complianceState.status}
                </span>
              }
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                  <b className="text-white">Status:</b> {complianceState.status}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                  <b className="text-white">Reason:</b> {complianceState.reason}
                </div>
              </div>
            </SectionCard>
          </div>

          <BroadcastStudio deviceId={id} />

          <SectionCard
            title="Historique AI"
            subtitle="Évolution du score d’anomalie dans le temps"
            right={
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                {aiHistory.length} analyses
              </span>
            }
          >
            <div className="h-80 rounded-3xl border border-slate-800 bg-[#0f172a] p-4">
              {aiChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Aucun historique AI disponible.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={aiChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="AI Score"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {aiHistory.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                  Aucune prédiction AI enregistrée.
                </div>
              ) : (
                <>
                  {visibleAi.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-cyan-500/30 hover:bg-[#101a31]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getPredictionBadge(item.prediction)}`}
                          >
                            {item.prediction}
                          </span>
                          <span className="text-xs text-slate-400">
                            Score: {Number(item.anomaly_score).toFixed(2)}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-200">
                        {item.reason}
                      </div>
                    </div>
                  ))}

                  {aiHistory.length > 5 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setShowAllAi((prev) => !prev)}
                        className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        {showAllAi ? "Afficher moins" : "Afficher plus"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Statistiques de performance"
            subtitle="Évolution en temps réel des métriques du screen"
          >
            <div className="h-96 rounded-3xl border border-slate-800 bg-[#0f172a] p-4">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  No chart data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      name="CPU"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ram"
                      name="RAM"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="TEMP"
                      stroke="#f97316"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Métriques récentes"
              subtitle="Dernières remontées envoyées par l’écran"
            >
              <div className="space-y-3">
                {metrics.length === 0 ? (
                  <p className="text-slate-500">No metrics found.</p>
                ) : (
                  <>
                    {visibleMetrics.map((metric) => (
                      <div
                        key={metric.id}
                        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm text-slate-400">
                            {new Date(metric.timestamp).toLocaleString()}
                          </div>
                          <div className="text-sm font-medium text-slate-200">
                            CPU: {metric.cpu}% | RAM: {metric.ram}% | TEMP:{" "}
                            {metric.temp != null ? `${metric.temp}°C` : "-"} |
                            VLC: {metric.vlc_running ? " Running" : " Stopped"}
                          </div>
                        </div>
                      </div>
                    ))}

                    {metrics.length > 5 && (
                      <div className="pt-2">
                        <button
                          onClick={() => setShowAllMetrics((prev) => !prev)}
                          className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          {showAllMetrics ? "Afficher moins" : "Afficher plus"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Alertes récentes"
              subtitle="Événements critiques ou informatifs"
            >
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <p className="text-slate-500">No alerts found.</p>
                ) : (
                  <>
                    {visibleAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAlertBadge(alert.type)}`}
                            >
                              {alert.type}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(alert.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-slate-200">
                          {alert.message}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Value: {alert.value ?? "-"} | Threshold:{" "}
                          {alert.threshold ?? "-"}
                        </div>
                      </div>
                    ))}

                    {alerts.length > 5 && (
                      <div className="pt-2">
                        <button
                          onClick={() => setShowAllAlerts((prev) => !prev)}
                          className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          {showAllAlerts ? "Afficher moins" : "Afficher plus"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
