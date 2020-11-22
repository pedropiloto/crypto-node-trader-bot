const supportedPairs = ['BTC-EUR', 'XLM-EUR'];

module.exports.validateExecuteTradeRequest = (
  request, productInfo,
) => ((request.action !== 'BUY' || request.action !== 'SELL')
&& (supportedPairs.filter((x) => x === productInfo.productPair)).length === 1
&& request.metric
&& request.value
);
