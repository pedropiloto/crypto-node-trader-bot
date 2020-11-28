const newrelic = require('newrelic');
require('dotenv').config();

const appName = `${process.env.APP_NAME}`;

const memoryMetric = () => {
  setInterval(() => {
    const stats = process.memoryUsage();
    stats.app_name = appName;

    newrelic.recordCustomEvent('NodeMemory', stats);
  }, 5000);
};

const cpuUsageMetric = () => {
  if (process.cpuUsage) {
    let lastUsage;
    // sampling interval in milliseconds
    const interval = 60000;

    setInterval(() => {
      // get CPU usage since the process started
      const usage = process.cpuUsage();

      if (lastUsage) {
        // calculate percentage
        const intervalInMicros = interval * 1000;
        const userPercent = ((usage.user - lastUsage.user) / intervalInMicros) * 100;
        newrelic.recordCustomEvent('NodeCPU', {
          app_name: appName,
          userPercent,
        });
      }

      lastUsage = usage;
    }, interval);
  }
};

module.exports = { memoryMetric, cpuUsageMetric };
