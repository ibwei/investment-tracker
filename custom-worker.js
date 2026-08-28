import nextWorker from "./.open-next/worker.js";

const CRON_PATHS = {
  "0 */12 * * *": "/api/cron/snapshots",
  "5 */2 * * *": "/api/cron/assets/sync",
  "0 1/4 * * *": "/api/cron/investments/settle",
  "0 2 * * *": "/api/cron/investments/expiry-reminders",
  "0 14 * * *": "/api/cron/investments/expiry-reminders"
};

const SNAPSHOT_CRON = "0 */12 * * *";
const DAILY_REPORT_PATH = "/api/cron/telegram/daily-report";

function getScheduledPaths(controller) {
  const path = CRON_PATHS[controller.cron];
  if (!path) {
    return [];
  }

  const paths = [path];
  if (
    controller.cron === SNAPSHOT_CRON &&
    new Date(controller.scheduledTime).getUTCHours() === 0
  ) {
    paths.push(DAILY_REPORT_PATH);
  }

  return paths;
}

async function runScheduledPath(path, controller, env, ctx) {
  const request = new Request(`https://earn-compass.local${path}`, {
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "X-Cron-Scheduled-At": new Date(controller.scheduledTime).toISOString()
    }
  });
  const response = await nextWorker.fetch(request, env, ctx);

  if (!response.ok) {
    console.error(JSON.stringify({
      message: "Scheduled route failed.",
      cron: controller.cron,
      path,
      status: response.status
    }));
    await response.body?.cancel();
    throw new Error(`Scheduled route ${path} failed with status ${response.status}.`);
  }

  await response.body?.cancel();
}

async function runScheduledPaths(paths, controller, env, ctx) {
  const results = await Promise.allSettled(
    paths.map((path) => runScheduledPath(path, controller, env, ctx))
  );
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (failedCount > 0) {
    throw new Error(`${failedCount} scheduled route(s) failed.`);
  }
}

export default {
  fetch: nextWorker.fetch,

  async scheduled(controller, env, ctx) {
    const paths = getScheduledPaths(controller);

    if (paths.length === 0) {
      console.warn(JSON.stringify({
        message: "Skipped unrecognized scheduled job.",
        cron: controller.cron
      }));
      return;
    }

    if (!env.CRON_SECRET) {
      console.error(JSON.stringify({
        message: "Cannot run scheduled job because CRON_SECRET is missing.",
        cron: controller.cron
      }));
      throw new Error("CRON_SECRET is required for scheduled jobs.");
    }

    ctx.waitUntil(runScheduledPaths(paths, controller, env, ctx));
  }
};
