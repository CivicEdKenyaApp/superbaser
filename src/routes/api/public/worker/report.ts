import { createFileRoute } from "@tanstack/react-router";

// External worker reports job progress or heartbeat.
export const Route = createFileRoute("/api/public/worker/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WORKER_WEBHOOK_SECRET;
        if (!secret) return new Response("Server not configured", { status: 500 });
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as {
          type: "heartbeat" | "job";
          workerId: string;
          version?: string;
          queue?: string;
          cpu?: number;
          ram?: number;
          runningJobId?: string;
          job?: {
            id: string;
            status?: "running" | "succeeded" | "failed" | "cancelled";
            stage?: string;
            progress?: number;
            bytesTotal?: number;
            bytesUploaded?: number;
            errorCode?: string;
            errorMessage?: string;
            result?: unknown;
          };
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.type === "heartbeat") {
          await supabaseAdmin.from("worker_heartbeats").upsert({
            id: body.workerId,
            version: body.version ?? null,
            queue: body.queue ?? null,
            cpu_percent: body.cpu ?? null,
            ram_mb: body.ram ?? null,
            running_job_id: body.runningJobId ?? null,
            last_seen_at: new Date().toISOString(),
          });
          return Response.json({ ok: true });
        }

        if (body.type === "job" && body.job) {
          const j = body.job;
          const jobUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (j.status === "running") jobUpdate.status = "running";
          if (j.status === "succeeded") { jobUpdate.status = "succeeded"; jobUpdate.finished_at = new Date().toISOString(); }
          if (j.status === "failed") { jobUpdate.status = "failed"; jobUpdate.finished_at = new Date().toISOString(); }
          if (j.status === "cancelled") { jobUpdate.status = "cancelled"; jobUpdate.finished_at = new Date().toISOString(); }
          if (j.errorCode) jobUpdate.error_code = j.errorCode;
          if (j.errorMessage) jobUpdate.error_message = j.errorMessage;
          if (j.result !== undefined) jobUpdate.result = j.result;
          await supabaseAdmin.from("jobs").update(jobUpdate as never).eq("id", j.id);

          const { data: jobRow } = await supabaseAdmin
            .from("jobs")
            .select("kind, backup_id, restore_id")
            .eq("id", j.id)
            .maybeSingle();

          if (jobRow?.backup_id) {
            const bu: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (j.stage) bu.stage = j.stage;
            if (typeof j.progress === "number") bu.progress_percent = j.progress;
            if (typeof j.bytesTotal === "number") bu.bytes_total = j.bytesTotal;
            if (typeof j.bytesUploaded === "number") bu.bytes_uploaded = j.bytesUploaded;
            if (j.status === "running") bu.status = "running";
            if (j.status === "succeeded") { bu.status = "completed"; bu.finished_at = new Date().toISOString(); }
            if (j.status === "failed") { bu.status = "failed"; bu.finished_at = new Date().toISOString(); bu.error_code = j.errorCode ?? null; bu.error_message = j.errorMessage ?? null; }
            if (j.status === "cancelled") { bu.status = "cancelled"; bu.finished_at = new Date().toISOString(); }
            await supabaseAdmin.from("backups").update(bu as never).eq("id", jobRow.backup_id);
          }
          if (jobRow?.restore_id) {
            const ru: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (j.stage) ru.stage = j.stage;
            if (typeof j.progress === "number") ru.progress_percent = j.progress;
            if (j.status === "running") ru.status = "running";
            if (j.status === "succeeded") { ru.status = "completed"; ru.finished_at = new Date().toISOString(); }
            if (j.status === "failed") { ru.status = "failed"; ru.finished_at = new Date().toISOString(); ru.error_code = j.errorCode ?? null; ru.error_message = j.errorMessage ?? null; }
            if (j.status === "cancelled") { ru.status = "cancelled"; ru.finished_at = new Date().toISOString(); }
            await supabaseAdmin.from("restores").update(ru as never).eq("id", jobRow.restore_id);
          }

          return Response.json({ ok: true });
        }

        return new Response("Bad request", { status: 400 });
      },
    },
  },
});
