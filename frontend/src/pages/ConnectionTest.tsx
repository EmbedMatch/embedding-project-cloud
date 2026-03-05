import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type HealthResponse = {
  version: string;
  storage: string;
  cosmos: string;
  llm: string;
  queue: string;
  status: string;
};

type ChatResponse = {
  reply: string;
};

function StatusBadge({ value }: { value: string }) {
  const ok = value === "ok" || value === "healthy";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-sm font-mono font-semibold ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {value}
    </span>
  );
}

export default function ConnectionTest() {
  const [message, setMessage] = useState("");

  const health = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => fetch(`${API_URL}/health`).then((r) => r.json()),
    retry: 1,
    refetchInterval: 30000,
  });

  const fnHealth = useQuery<{ status: string }>({
    queryKey: ["fn-health"],
    queryFn: async () => {
      try {
        const r = await fetch("https://embed-benchmark-fn.azurewebsites.net/", { mode: "no-cors" });
        return { status: "reachable" };
      } catch {
        return { status: "unreachable" };
      }
    },
    retry: 1,
    refetchInterval: 30000,
  });

  const chat = useMutation<ChatResponse, Error, string>({
    mutationFn: (msg) =>
      fetch(`${API_URL}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(async () => ({ detail: await r.text() }));
          throw new Error(body.detail ?? JSON.stringify(body));
        }
        return r.json();
      }),
  });

  const services = health.data
    ? [
        { name: "Backend API", status: health.data.status },
        { name: "Blob Storage", status: health.data.storage },
        { name: "Cosmos DB", status: health.data.cosmos },
        { name: "Azure OpenAI (LLM)", status: health.data.llm },
        { name: "Storage Queue", status: health.data.queue },
        { name: "Function App", status: fnHealth.data?.status ?? "checking…" },
      ]
    : [];

  return (
    <div className="max-w-xl mx-auto mt-16 p-6 space-y-8">
      <h1 className="text-2xl font-bold">Service Status</h1>

      {/* Service status overview */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-lg">All Services</h2>
        {health.isLoading && <p className="text-muted-foreground text-sm">Checking…</p>}
        {health.isError && (
          <p className="text-red-600 text-sm">
            Cannot reach backend at <code>{API_URL || "relative URL"}</code>
          </p>
        )}
        {services.length > 0 && (
          <table className="text-sm w-full">
            <tbody className="divide-y">
              {services.map((s) => (
                <tr key={s.name} className="py-1">
                  <td className="pr-4 text-muted-foreground py-1">{s.name}</td>
                  <td className="py-1">
                    <StatusBadge value={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">Auto-refreshes every 30s</p>
      </section>

      {/* LLM chat test */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-lg">LLM Test</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && message.trim()) chat.mutate(message);
            }}
            placeholder="Ask something…"
            className="flex-1 border rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => { if (message.trim()) chat.mutate(message); }}
            disabled={chat.isPending || !message.trim()}
            className="rounded bg-blue-600 text-white px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {chat.isPending ? "…" : "Send"}
          </button>
        </div>
        {chat.isError && (
          <p className="text-red-600 text-sm">Error: {chat.error.message}</p>
        )}
        {chat.data && (
          <p className="text-sm bg-gray-50 rounded p-3 whitespace-pre-wrap">{chat.data.reply}</p>
        )}
      </section>
    </div>
  );
}
