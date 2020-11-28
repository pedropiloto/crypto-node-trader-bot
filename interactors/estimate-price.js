/* eslint-disable no-console */
const CoinbaseGateway = require('../gateways/coinbase-gateway');

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
