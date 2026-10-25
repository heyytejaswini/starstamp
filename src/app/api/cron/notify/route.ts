import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // 1. Only Vercel's scheduler (or you) may call this.
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Admin client: bypasses RLS so we can read emails and update letters.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 3. Find letters whose date has arrived and we haven't emailed yet.
  const { data: due, error } = await admin
    .from("letters")
    .select("id, author_id")
    .eq("unlock_type", "date")
    .lte("unlock_at", new Date().toISOString())
    .is("notified_at", null)
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return Response.json({ sent: 0 });

  // 4. Group by writer so each person gets one email, not one per letter.
  const byAuthor = new Map<string, string[]>();
  for (const l of due) {
    byAuthor.set(l.author_id, [...(byAuthor.get(l.author_id) ?? []), l.id]);
  }

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  let sent = 0;
  for (const [authorId, ids] of byAuthor) {
    const { data } = await admin.auth.admin.getUserById(authorId);
    const to = data.user?.email;
    if (!to) continue;

    const many = ids.length > 1;
    try {
      await transport.sendMail({
        from: `"Starstamp" <${process.env.GMAIL_USER}>`,
        to,
        subject: many ? "Your stars are ready to open" : "Your star is ready to open",
        text:
          `A letter you sealed for your future self is ready.\n\n` +
          `Open it here: ${process.env.NEXT_PUBLIC_SITE_URL}\n\n` +
          `Starstamp`,
      });
      // 5. Mark as notified only after the email actually went out.
      await admin.from("letters").update({ notified_at: new Date().toISOString() }).in("id", ids);
      sent++;
    } catch {
      // leave notified_at empty so tomorrow's run tries again
    }
  }

  return Response.json({ sent });
}