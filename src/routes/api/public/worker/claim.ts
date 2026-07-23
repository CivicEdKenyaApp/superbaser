import { createFileRoute } from "@tanstack/react-router";

// External worker claims a queued job. Auth: bearer WORKER_WEBHOOK_SECRET.
export const Route = createFileRoute("/api/public/worker/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WORKER_WEBHOOK_SECRET;
        if (!secret) return new Response("Server not configured", { status: 500 });
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { workerId?: string; kinds?: string[] };
        if (!body.workerId) return new Response("workerId required", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const kinds = body.kinds && body.kinds.length ? body.kinds : ["backup", "restore", "verify", "storage", "cleanup", "notification", "billing"];

        const { data: candidates, error } = await supabaseAdmin
          .from("jobs")
          .select("id")
          .eq("status", "queued")
          .in("kind", kinds)
          .lte("scheduled_for", new Date().toISOString())
          .order("priority", { ascending: true })
          .order("scheduled_for", { ascending: true })
          .limit(1);
        if (error) return new Response(error.message, { status: 500 });
        if (!candidates?.length) return Response.json({ job: null });

        const jobId = candidates[0].id;
        const { data: claimed, error: uErr } = await supabaseAdmin
          .from("jobs")
          .update({
            status: "claimed",
            claimed_by: body.workerId,
            claimed_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            attempt: 1,
          })
          .eq("id", jobId)
          .eq("status", "queued")
          .select()
          .maybeSingle();
        if (uErr) return new Response(uErr.message, { status: 500 });
        return Response.json({ job: claimed });
      },
    },
  },
});
