# Cripto Node Trader Bot

## Description

Simple tracker that connects to coinbase-pro websocket and triggers a webhook for buy or sell based on technical indicators calculation.

The bot connects to coinbase pro and relies on two base kind of conservative rules to run:
- There will be one and only one trade open
- The bot will never sell without profit. This will only happen if the sell rest endpoint is called with the `force` flag set to true

The bot has two main components:
- Consumer - Responsible for connecting with the coinbase pro websockets server and to decide when to buy or sell based on technical indicators.
- Web - Responsible to for giving visibility of the bot and to force sells.

## Environment Variables

| Name                  | Description                                                                                    | Required |
|-----------------------|------------------------------------------------------------------------------------------------|----------|
| API_KEY               | Api Key generated within coinbase pro portefolio dashboard.                                    | YES      |
| API_SECRET            | Api secret correspondent to the api key.                                                       | YES      |
| API_PASSPHRASE        | Api passphrase correspondent to the api key.                                                   | YES      |
| USE_SANDBOX           | Indicates if the bot is working with a coinbase pro sandbox or not.                            | YES      |
| LOG_LEVEL             | Log level, it should be dbug for development purposes and info for production purposes.        | YES      |
| BASE_CURRENCY_NAME    | The base currency. Ex: BTC, ETH, XRP, XLM...                                                   | YES      |
| QUOTE_CURRENCY_NAME   | The quote currency. Ex: EUR, USD.                                                              | YES      |
| APP_NAME              | The name of the app, this parameter is mostly used for logging purposes.                       | NO       |
| LOGZIO_TOKEN          | Token generated within logzio dashboard.                                                       | NO       |
| NODE_ENV              | Variable used to identify the environment of the app. Should be `development` or `production`. | YES      |
| NEW_RELIC_LICENSE_KEY | New relic license key.                                                                         | NO       |
| BUSGNAG_API_KEY       | Bugnsnag api key. It will only be initialized in `production` environment.                     | NO       |
| MONGODB_URL           | MongoDB connection URL.                                                                        | YES      |
| TRADE_BOT_API_KEY     | Value used to protect to the api exposed by the bot web component.                             | YES      |                                                          


## Test

```sh
$ yarn
$ yarn test
```

## Running

```sh
$ yarn
$ cp .env.example .env
$ yarn start-consumer
$ yarn start-web
```
