require('dotenv').config();

module.exports = (req, res, next) => {
  try {
    const apiKey = req.headers.api_key;
    if (process.env.NODE_ENV === 'production') {
      if (apiKey !== process.env.TRADE_BOT_API_KEY) {
        throw (new Error('Not authorized'));
      }
    }
    next();
  } catch {
    res.status(401).json({
      error: new Error('Invalid request!'),
    });
  }
};
