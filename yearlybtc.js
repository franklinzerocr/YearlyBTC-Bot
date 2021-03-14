import config from 'config';
import { TwitterClient } from 'twitter-api-client';
import { Bitstamp, CURRENCY } from 'node-bitstamp';

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

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

(async function () {
  console.log('Start yearlybtc-bot!');
  console.log(new Date());
  console.log('-------');

  const twitter = new TwitterClient({
    apiKey: config.TwitterKeys.apiKey,
    apiSecret: config.TwitterKeys.apiSecret,
    accessToken: config.TwitterKeys.accessTokenBot,
    accessTokenSecret: config.TwitterKeys.accessTokenSecretBot,
  });
  const bitstampAPI = new Bitstamp({
    key: config.BitstampKeys.key,
    secret: config.BitstampKeys.secret,
    clientId: config.BitstampKeys.clientId,
    timeout: 5000,
    rateLimit: true, //turned on by default
  });

  let dateNow = null,
    nowYear = null,
    nowMonth = null,
    nowDay = null,
    nowHours = null,
    initialYear = 2012,
    tweet = '',
    errorCounter = 0,
    historicPrices = {};

  // Wait till 12pm GMT to start the daily bucle
  while (!dateNow || nowHours != 12) {
    await sleep(1000);
    dateNow = new Date();
    nowHours = dateNow.getHours();
    // console.log(nowHours);
  }

  let timerId = setTimeout(async function tick() {
    dateNow = new Date();
    nowYear = dateNow.getFullYear();
    nowMonth = dateNow.getMonth() + 1;
    nowDay = dateNow.getDate();
    nowHours = dateNow.getHours();
    errorCounter = 0;

    while (1 == 1) {
      try {
        //loop through each year from 2012 to extract the bitcoin price
        for (let year = initialYear; year < nowYear; year++) {
          let historicDateInit = nowMonth + '-' + nowDay + '-' + year + '  11:00';
          let historicDateInitTimeStamp = Math.round(+new Date(historicDateInit) / 1000);

          let historicDateEnd = nowMonth + '-' + nowDay + '-' + year + '  12:00';
          let historicDateEndTimeStamp = Math.round(+new Date(historicDateEnd) / 1000);

          //get price of candle in given moment
          const ohlc = await bitstampAPI.ohlc(CURRENCY.BTC_USD, historicDateInitTimeStamp, historicDateEndTimeStamp);
          historicPrices[year] = numberWithCommas(Math.floor(ohlc.body.data.ohlc[0].close));
        }

        // get last price of the "now moment"
        historicPrices[nowYear] = numberWithCommas(Math.floor((await bitstampAPI.ticker(CURRENCY.BTC_USD)).body.last));

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

    //Construct the tweet
    tweet = '#Bitcoin price on ' + getMonth(nowMonth) + ' ' + nowDay + ':\n\n';
    for (let year = nowYear; year >= initialYear; year--) {
      tweet += year + ' -> $' + historicPrices[year] + '\n';
    }
    tweet += '\n#bitcoinPriceOnThisDay';

    //Tweet
    await twitter.tweets.statusesUpdate({ status: tweet });

    console.log('-------');
    console.log(dateNow);
    console.log(tweet);

    timerId = setTimeout(tick, 86400000);
  }, 0);
})();
