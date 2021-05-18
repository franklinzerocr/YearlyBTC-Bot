import mysql from 'promise-mysql';
import config from 'config';
import { TwitterClient } from 'twitter-api-client';
import { Bitstamp, CURRENCY } from 'node-bitstamp';
import schedule from 'node-schedule';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(config.telegram.key);

function sleep(ms) {
  return new Promise((resolve) => {
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
  async function storeChatID(chatID, title, type) {
    try {
      let result = await dbConnection.query('INSERT INTO `chats` (`chatID`,`title`,`type`) VALUES ("' + chatID + '","' + title + '","' + type + '");');
      return result.insertId;
    } catch (e) {
      if (e.code == 'ER_DUP_ENTRY') return false;
      console.log(e);
      console.log('storeChatID error');
      return false;
    }
  }

  async function updateStatus(chatID, status) {
    try {
      let result = await dbConnection.query('UPDATE chats SET status=' + status + " WHERE chatID='" + chatID + "';");

      return result;
    } catch (e) {
      console.log(e);
      console.log('updateStatus error');
      return false;
    }
  }

  async function getActiveChats() {
    try {
      let result = await dbConnection.query('SELECT * FROM chats WHERE status=1');
      return result;
    } catch (e) {
      console.log(e);
      console.log('updateStatus error');
      return false;
    }
  }

  async function botFunctions() {
    bot.start(async (ctx) => {
      ctx.reply('This Bot messages the Bitcoin Price on this day from every past year.\n\nAdd it to your group, so it can message these prices at 12pm GMT and 22pm GMT every day.\n\nAlso you can request the prices using the /yearlyBTC command\n\nSupport: @franklinzerocr');
      // console.log(ctx.message.chat);
      await storeChatID(ctx.message.chat.id, ctx.message.chat.type == 'private' ? ctx.message.chat.username : ctx.message.chat.title, ctx.message.chat.type);
    });
    //

    bot.command('enable', async (ctx) => {
      await updateStatus(ctx.message.chat.id, 1);
      ctx.replyWithMarkdown('Auto Report is *ENABLED* ✅');
    });
    bot.command('disable', async (ctx) => {
      await updateStatus(ctx.message.chat.id, 0);
      ctx.replyWithMarkdown('Auto Report is *DISABLED*❌');
    });
    bot.command('yearlybtc', async (ctx) => {
      let message = await getYearlyBTCTweet();
      ctx.reply(message);
    });

    bot.on('text', async (ctx) => {
      await storeChatID(ctx.update.message.chat.id, ctx.update.message.chat.type == 'private' ? ctx.update.message.chat.username : ctx.update.message.chat.title, ctx.update.message.chat.type);
    });

    bot.launch();

    bot.catch((error) => {
      console.log('------- telegraf error------\n', error);
    });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  async function getYearlyBTCTweet() {
    while (1 == 1) {
      try {
        //loop through each year from 2012 to extract the bitcoin price
        for (let year = initialYear; year < nowYear; year++) {
          let historicDateInit = nowMonth + '-' + nowDay + '-' + year + '  11:00';
          let historicDateInitTimeStamp = Math.round(+new Date(historicDateInit) / 1000);

          let historicDateEnd = nowMonth + '-' + nowDay + '-' + year + '  12:00';
          let historicDateEndTimeStamp = Math.round(+new Date(historicDateEnd) / 1000);

          //get price of candle in given moment
          // This function OHLC does not exist on the Library. So I had to create it and put it in Bitstamp.js in line 174
          // ohlc(currency = null,start=null,end=null, step=3600,limit=1){
          //     const ep = "ohlc";
          //     return this.call(this._resolveEP(ep, currency)+ `?start=${start}`+ `&end=${end}`+ `&step=${step}`+ `&limit=${limit}`, HTTP_METHOD.GET, null, false)
          // }
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
      tweet += year + ': $' + historicPrices[year] + '\n';
    }
    tweet += '\n#bitcoinPriceOnThisDay';

    return tweet;
  }

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

  const dbConnection = await mysql.createPool({
    host: config.DB.Host,
    user: config.DB.User,
    password: config.DB.Password,
    database: config.DB.DatabaseName,
    connectionLimit: 100,
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

  dateNow = new Date();
  nowYear = dateNow.getFullYear();
  nowMonth = dateNow.getMonth() + 1;
  nowDay = dateNow.getDate();
  nowHours = dateNow.getHours();
  errorCounter = 0;

  await botFunctions();

  schedule.scheduleJob({ hour: 12, minute: 0, second: 0 }, async function () {
    tweet = await getYearlyBTCTweet();
    //   //Tweet
    await twitter.tweets.statusesUpdate({ status: tweet });

    //   //Telegram Message
    let chats = await getActiveChats();
    for (let chat of chats) bot.telegram.sendMessage(chat.chatID, tweet);
  });

  schedule.scheduleJob({ hour: 22, minute: 0, second: 0 }, async function () {
    tweet = await getYearlyBTCTweet();
    //Telegram Message
    let chats = await getActiveChats();
    for (let chat of chats) bot.telegram.sendMessage(chat.chatID, tweet);
  });
})();
