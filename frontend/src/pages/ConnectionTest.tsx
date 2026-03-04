import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type HealthResponse = {
  version: string;
  storage: string;
  cosmos: string;
  llm: string;
  status: string;
};

type UploadResponse = {
  blob_name: string;
  url: string;
  filename: string;
};

function StatusBadge({ value }: { value: string }) {
  const ok = value === "ok";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const health = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => fetch(`${API_URL}/health`).then((r) => r.json()),
    retry: 1,
  });

  const upload = useMutation<UploadResponse, Error, File>({
    mutationFn: (file) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${API_URL}/uploads/`, { method: "POST", body: form }).then(
        async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(async () => ({ detail: await r.text() }));
            throw new Error(body.detail ?? JSON.stringify(body));
          }
          return r.json();
        }
      );
    },
  });

  return (
    <div className="max-w-xl mx-auto mt-16 p-6 space-y-8">
      <h1 className="text-2xl font-bold">Connection Test</h1>

      {/* Health check */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-lg">Backend Health</h2>
        {health.isLoading && <p className="text-muted-foreground text-sm">Checking…</p>}
        {health.isError && (
          <p className="text-red-600 text-sm">
            Cannot reach backend at <code>{API_URL || "relative URL"}</code>
          </p>
        )}
        {health.data && (
          <table className="text-sm w-full">
            <tbody className="divide-y">
              {Object.entries(health.data).map(([k, v]) => (
                <tr key={k} className="py-1">
                  <td className="pr-4 text-muted-foreground capitalize py-1">{k}</td>
                  <td className="py-1">
                    {k === "status" || k === "storage" || k === "cosmos" || k === "llm" ? (
                      <StatusBadge value={String(v)} />
                    ) : (
                      <span className="font-mono">{String(v)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={() => health.refetch()}
          className="text-xs text-blue-600 underline"
        >
          Refresh
        </button>
      </section>

      {/* File upload test */}
      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-lg">Upload Test</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV, JSON, or TXT file (max 50 MB) to Azure Blob Storage.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json,text/plain"
          className="block text-sm"
        />
        <button
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (file) upload.mutate(file);
          }}
          disabled={upload.isPending}
          className="rounded bg-blue-600 text-white px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {upload.isPending ? "Uploading…" : "Upload"}
        </button>
        {upload.isError && (
          <p className="text-red-600 text-sm">Error: {upload.error.message}</p>
        )}
        {upload.data && (
          <div className="text-sm space-y-1">
            <p className="text-green-700 font-semibold">Upload successful!</p>
            <p className="font-mono text-xs break-all">{upload.data.url}</p>
          </div>
        )}
      </section>
    </div>
  );
}
