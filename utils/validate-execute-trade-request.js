module.exports.validateExecuteTradeRequest = (
  request,
) => ((request.action !== 'BUY' || request.action !== 'SELL')
&& request.metric
&& request.value
);
