import config from 'config';
import { twitterAPI } from './twitterApi.mjs';
import { binanceAPI } from './binanceAPI.mjs';

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function getMonth(monthNumber) {
  switch (monthNumber) {
    case 1:
      return 'January';
    case 2:
      return 'February';
    case 3:
      return 'March';
    case 4:
      return 'April';
    case 5:
      return 'May';
    case 6:
      return 'June';
    case 7:
      return 'July';
    case 8:
      return 'August';
    case 9:
      return 'September';
    case 10:
      return 'October';
    case 11:
      return 'November';
    case 12:
      return 'December';
  }
}

(async function () {
  console.log('Start yearlybtc-bot!');

  const twitter = await twitterAPI(config.TwitterKeys);
  const binance = await binanceAPI(config.BinanceKeys);

  let dateNow = null,
    nowYear = null,
    nowMonth = null,
    nowDay = null,
    nowHours = null,
    initialYear = 2018,
    tweet = '',
    errorCounter = 0,
    historicPrices = {};

  while (!dateNow || nowHours != 5) {
    await sleep(1000);
    dateNow = new Date();
    nowHours = dateNow.getHours();
    console.log(nowHours);
  }

  let timerId = setTimeout(async function tick() {
    dateNow = new Date();
    nowYear = dateNow.getFullYear();
    nowMonth = dateNow.getMonth() + 1;
    nowDay = dateNow.getDate();
    nowHours = dateNow.getHours();
    errorCounter = 0;

    if (nowMonth >= 8) initialYear = 2017;

    while (1 == 1) {
      try {
        for (let year = initialYear; year < nowYear; year++) {
          let historicDateInit = nowMonth + '-' + nowDay + '-' + year + '  4:00';
          let historicDateInitTimeStamp = +new Date(historicDateInit);

          let historicDateEnd = nowMonth + '-' + nowDay + '-' + year + '  5:00';
          let historicDateEndTimeStamp = +new Date(historicDateEnd);

          await binance.candlesticks(
            'BTCUSDT',
            '1h',
            (error, ticks, symbol) => {
              let last_tick = ticks[ticks.length - 1];
              let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
              historicPrices[year] = Math.floor(close);
            },
            { limit: 1, startTime: historicDateInitTimeStamp, endTime: historicDateEndTimeStamp }
          );
        }

        while (Object.keys(historicPrices).length < nowYear - initialYear) {
          await sleep(100);
        }

        historicPrices[nowYear] = Math.floor((await binance.prices('BTCUSDT')).BTCUSDT);
        break;
      } catch (e) {
        console.log('-Error-');
        console.log(e);
        errorCounter++;
        if (errorCounter >= 60) {
          console.log('Too many errors- EXIT');
          process.exit();
        }
        await sleep(1000);
      }
    }

    tweet = '#Bitcoin on ' + getMonth(nowMonth) + ' ' + nowDay + ' of each year:\n\n';

    for (let year = initialYear; year <= nowYear; year++) {
      tweet += year + ' -> $' + historicPrices[year] + '\n';
    }

    let status = await twitter.tweets.statusesUpdate({ status: tweet });

    // console.log(status);

    timerId = setTimeout(tick, 86400000);
  }, 0);
  //
})();
