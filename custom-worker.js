import nextWorker from "./.open-next/worker.js";

const CRON_PATHS = {
  "0 */12 * * *": "/api/cron/snapshots",
  "0 */4 * * *": "/api/cron/assets/sync",
  "0 1/4 * * *": "/api/cron/investments/settle",
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

    ctx.waitUntil((async () => {
      try {
        const response = await nextWorker.fetch(request, env, ctx);
        if (!response.ok) {
          console.error(
            `Scheduled job ${controller.cron} failed with ${response.status}: ${await response.text()}`
          );
        }
      } catch (error) {
        console.error(`Scheduled job ${controller.cron} failed.`, error);
      }
    })());
  }
};
