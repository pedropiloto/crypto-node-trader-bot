const mongoose = require('mongoose');

const STARTED = 'started';
const COMPLETED = 'completed';

// Define a schema
const { Schema } = mongoose;

const TradeSchema = new Schema({
  symbol: {
    type: String,
    trim: true,
    required: true,
  },
  buy_order_id: {
    type: String,
    trim: true,
    required: true,
  },
  buy_last_closing_price: {
    type: String,
    trim: true,
  },
  buy_estimated_effective_price: {
    type: String,
    trim: true,
    required: true,
  },
  buy_metric_value: {
    type: String,
    trim: true,
  },
  sell_order_id: {
    type: String,
    trim: true,
  },
  sell_last_closing_price: {
    type: String,
    trim: true,
  },
  sell_estimated_effective_price: {
    type: String,
    trim: true,
  },
  sell_metric_value: {
    type: String,
    trim: true,
  },
  started_at: {
    type: Date,
    required: true,
  },
  finished_at: {
    type: Date,
  },
  rejected_sell_orders: [{
    date: {
      type: Date,
    },
    market_value: {
      type: String,
      trim: true,
    },
    effective_total: {
      type: String,
      trim: true,
    },
    metric_value: {
      type: String,
      trim: true,
    },
  }],
  platform: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: [STARTED, COMPLETED],
    default: STARTED,
  },
});

TradeSchema.virtual('open_duration').get(function () {
  const finishDate = this.finished_at ? this.finished_at : Date.now();
  const startDate = this.started_at;

  let seconds = Math.floor((finishDate - (startDate)) / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  hours -= (days * 24);
  minutes = minutes - (days * 24 * 60) - (hours * 60);
  seconds = seconds - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60);

  return `${days}d ${hours}:${minutes}:${seconds}`;
});

TradeSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.rejected_sell_orders = ret.rejected_sell_orders.length;
    delete ret.rejected_sell_orders;
  },
});

module.exports = { TradeModel: mongoose.model('Trade', TradeSchema), STARTED, COMPLETED };
