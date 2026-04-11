const RESEND_API_URL = "https://api.resend.com/emails";

function assertEmailConfig() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send email reminders.");
  }
}

export async function sendEmail({ to, subject, html, text }) {
  assertEmailConfig();

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "cefidefi/0.1.1"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "CeFiDeFi <onboarding@resend.dev>",
      to,
      subject,
      html,
      text
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error?.message ||
      `Email provider returned ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}
