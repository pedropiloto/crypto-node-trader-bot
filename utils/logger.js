const pino = require('pino');
const newrelic = require('newrelic');
const logzio = require('logzio-nodejs').createLogger({
  token: `${process.env.LOGZIO_TOKEN}`,
  protocol: 'https',
  host: 'listener.logz.io',
  port: '8071',
  type: 'nodejs',
});

const logger = pino({ level: process.env.LOG_LEVEL || 'info', prettyPrint: { colorize: true } });
const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, INFO_SEVERITY,
} = require('./constants');

const log = (params) => {
  if (!params.severity) {
    // eslint-disable-next-line no-param-reassign
    params.severity = INFO_SEVERITY;
  }
  if (!params.app_name) {
    // eslint-disable-next-line no-param-reassign
    params.app_name = `${process.env.APP_NAME}`;
  }
  if (params.type === BUSINESS_LOG_TYPE) {
    logger.debug(params);
  } else {
    logger.info(params);
  }
  logzio.log(params);
  if (process.env.NODE_ENV === 'production') {
    if (params.transactional_event) {
      if (params.type === BUSINESS_LOG_TYPE) {
        newrelic.recordCustomEvent('BusinessEvent', params);
      }
      if (params.type === OPERATIONAL_LOG_TYPE) {
        newrelic.recordCustomEvent('OperationalEvent', params);
      }
    }
  }
};

const sendAndCloseLogzio = () => {
  logzio.sendAndClose();
};

module.exports = { log, sendAndCloseLogzio };
