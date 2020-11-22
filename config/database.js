// Set up mongoose connection
const mongoose = require('mongoose');

const mongoDB = process.env.MONGODB_URL;
mongoose.set('useFindAndModify', false);
mongoose.connect(mongoDB, {
  useNewUrlParser: true, useUnifiedTopology: true,
});
mongoose.Promise = global.Promise;

module.exports = mongoose;
