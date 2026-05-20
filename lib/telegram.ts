const TELEGRAM_API_URL = "https://api.telegram.org";
const TELEGRAM_MESSAGE_LIMIT = 4000;

function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return null;
  }

  return {
    botToken,
    chatId
  };
}

function splitTelegramText(text) {
  const chunks = [];
  const lines = String(text || "").split("\n");
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length <= TELEGRAM_MESSAGE_LIMIT) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (line.length <= TELEGRAM_MESSAGE_LIMIT) {
      current = line;
      continue;
    }

    for (let index = 0; index < line.length; index += TELEGRAM_MESSAGE_LIMIT) {
      chunks.push(line.slice(index, index + TELEGRAM_MESSAGE_LIMIT));
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [""];
}

export function isTelegramReminderConfigured() {
  return Boolean(getTelegramConfig());
}

export async function sendTelegramMessage({ text }) {
  const config = getTelegramConfig();

  if (!config) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required to send Telegram reminders.");
  }

  const chunks = splitTelegramText(text);
  const messages = [];

  for (const chunk of chunks) {
    const response = await fetch(`${TELEGRAM_API_URL}/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "cefidefi/0.1.1"
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: chunk,
        disable_web_page_preview: true
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok === false) {
      const message =
        payload?.description ||
        payload?.message ||
        `Telegram provider returned ${response.status}.`;
      throw new Error(message);
    }

    messages.push(payload?.result ?? payload);
  }

  return {
    messageIds: messages.map((message) => message?.message_id ?? null).filter(Boolean),
    chunkCount: messages.length
  };
}
