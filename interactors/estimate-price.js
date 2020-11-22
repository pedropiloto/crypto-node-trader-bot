/* eslint-disable no-console */
const { default: Bugsnag } = require('@bugsnag/js');
const CoinbaseGateway = require('../gateways/coinbase-gateway');
const { OPERATIONAL_LOG_TYPE, ERROR_SEVERITY } = require('../utils/constants');
const { log } = require('../utils/logger');

class EstimatePriceInteractor {
  constructor() {
    this.coinbaseGateway = new CoinbaseGateway();
  }

  async call(productInfo, action, funds, amount) {
    const estimatedFee = await this.coinbaseGateway
      .getEstimatePrice(productInfo, action, funds, amount);
    return estimatedFee;
  }
}

module.exports = EstimatePriceInteractor;
