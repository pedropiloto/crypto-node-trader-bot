const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const Bugsnag = require('@bugsnag/js');
const util = require('util');
const tradeController = require('../controllers/TradeController');
const mongoose = require('../config/database');

const { log } = require('../utils/logger');
const {
  OPERATIONAL_LOG_TYPE, ERROR_SEVERITY,
} = require('../utils/constants');
const auth = require('../middlewares/auth');

const app = express();

// connection to mongodb
mongoose.connection.on(
  'error',
  () => {
    log({
      message: 'MongoDB connection error',
      type: OPERATIONAL_LOG_TYPE,
      transactional: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(util.inspect(new Error('MongoDB connection error')));
  },

);

Bugsnag.start({ apiKey: `${process.env.BUSGNAG_API_KEY}` });

app.use(bodyParser.json());

app.get('/trade', auth, tradeController.getAll);
app.post('/trade/actions/execute', auth, tradeController.execute);
app.get('/summary', auth, tradeController.summary);

// express doesn't consider not found 404 as an error so we need to handle 404 it explicitly
// handle 404 error
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// handle errors
app.use((err, req, res, next) => {
  log({
    message: `server error ${err.stack}`,
    type: OPERATIONAL_LOG_TYPE,
    transactional: true,
    severity: ERROR_SEVERITY,
  });

  if (err.status === 404) res.status(404).json({ message: 'Not found' });
  else res.status(500).json({ message: 'Something looks wrong :( !!!' });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  log({
    message: `Node server listening on port ${port}`,
    type: OPERATIONAL_LOG_TYPE,
    transactional: true,
  });
});
