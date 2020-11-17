const newrelic = require('newrelic');

const memoryMetric = () => {
  setInterval(() => {
    const stats = process.memoryUsage();
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
        newrelic.recordCustomEvent('NodeCPU', { userPercent });
      }

      lastUsage = usage;
    }, interval);
  }
};

module.exports = { memoryMetric, cpuUsageMetric };
