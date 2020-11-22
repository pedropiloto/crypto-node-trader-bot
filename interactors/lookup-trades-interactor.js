const CoinbaseGateway = require('../gateways/coinbase-gateway');
const { TradeModel } = require('../models/trade');

class LookupTradesInteractor {
  constructor() {
    this.coinbaseGateway = new CoinbaseGateway();
  }

  // eslint-disable-next-line class-methods-use-this
  call() {
    return TradeModel.find({});
  }
}

module.exports = LookupTradesInteractor;
