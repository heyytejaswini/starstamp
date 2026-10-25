import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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
      const site = process.env.NEXT_PUBLIC_SITE_URL;
      await transport.sendMail({
        from: `"Starstamp" <${process.env.GMAIL_USER}>`,
        to,
        subject: many ? "Your stars are ready to open" : "Your star is ready to open",
        text:
          `A letter you sealed for your future self is ready.\n\n` +
          `Open it here: ${site}\n\nStarstamp`,
        html: `
          <div style="background:#0b1230;padding:32px 16px;font-family:Georgia,serif;">
            <table align="center" width="100%" style="max-width:480px;background:#141c44;border-radius:16px;">
              <tr><td align="center" style="padding:32px 24px 8px;">
                <img src="${site}/email-star.png" width="120" alt="A glowing star"
                     style="display:block;border:0;" />
              </td></tr>
              <tr><td align="center" style="padding:8px 24px;color:#f5d98b;font-size:24px;">
                ${many ? "Your stars are ready to open" : "Your star is ready to open"}
              </td></tr>
              <tr><td align="center" style="padding:8px 32px 24px;color:#c9d1f5;font-size:16px;line-height:1.6;">
                A letter you sealed for your future self has been waiting in the sky.
                Tonight, it's your turn to read it.
              </td></tr>
              <tr><td align="center" style="padding:0 24px 36px;">
                <a href="${site}"
                   style="background:#f5d98b;color:#0b1230;text-decoration:none;
                          padding:12px 28px;border-radius:999px;font-weight:bold;">
                  Open my star
                </a>
              </td></tr>
            </table>
          </div>`,
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