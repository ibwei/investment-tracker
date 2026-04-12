import nextWorker from "./.open-next/worker.js";

const CRON_PATHS = {
  "0 */12 * * *": "/api/cron/snapshots",
  "0 2 * * *": "/api/cron/investments/expiry-reminders",
  "0 14 * * *": "/api/cron/investments/expiry-reminders"
};

export default {
  fetch: nextWorker.fetch,

  async scheduled(controller, env, ctx) {
    const path = CRON_PATHS[controller.cron];

    if (!path || !env.CRON_SECRET) {
      console.warn("Skipped scheduled job because Cloudflare cron config is incomplete.");
      return;
    }

    const request = new Request(`https://earn-compass.local${path}`, {
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`
      }
    });

    ctx.waitUntil(
      nextWorker.fetch(request, env, ctx)
    );
  }
};
