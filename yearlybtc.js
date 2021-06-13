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

async function checkConfigRun(end) {
  let counter = 0;
  while (1 == 1) {
    await sleep(1000);
    counter++;
    if (counter > 10800) {
      console.log('Exit Individually Yeah');
      process.exit();
    }
  }
}

function getMonth(monthNumber) {
  switch (monthNumber) {
    case 1:
      return 'Jan';
    case 2:
      return 'Feb';
    case 3:
      return 'Mar';
    case 4:
      return 'Apr';
    case 5:
      return 'May';
    case 6:
      return 'Jun';
    case 7:
      return 'Jul';
    case 8:
      return 'Aug';
    case 9:
      return 'Sep';
    case 10:
      return 'Oct';
    case 11:
      return 'Nov';
    case 12:
      return 'Dec';
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
      console.log(ctx.message);
      ctx.reply('This Bot messages the Bitcoin Price on this day from every past year.\n\nAdd it to your group as Admin and use the /start command, so it can message these prices at 12pm GMT and 22pm GMT every day automatically.\n\nYou can also request the prices using the /yearlyBTC command\n\nSupport: @franklinzerocr');
      // console.log(ctx.message.chat);
      await storeChatID(ctx.message.chat.id, ctx.message.chat.type == 'private' ? ctx.message.chat.username : ctx.message.chat.title, ctx.message.chat.type);
    });
    //

    bot.command('enable', async (ctx) => {
      console.log(ctx.message);
      await updateStatus(ctx.message.chat.id, 1);
      ctx.replyWithMarkdown('Auto Report is *ENABLED* ✅');
    });
    bot.command('disable', async (ctx) => {
      console.log(ctx.message);
      await updateStatus(ctx.message.chat.id, 0);
      ctx.replyWithMarkdown('Auto Report is *DISABLED*❌');
    });

    bot.command('yearly', async (ctx) => {
      console.log(ctx.message);
      let message = await getYearlyBTCTweet('yearly');
      ctx.reply(message);
    });

    bot.command('monthly', async (ctx) => {
      console.log(ctx.message);
      let message = await getYearlyBTCTweet('monthly');
      ctx.reply(message);
    });

    bot.on('text', async (ctx) => {
      await storeChatID(ctx.update.message.chat.id, ctx.update.message.chat.type == 'private' ? ctx.update.message.chat.username : ctx.update.message.chat.title, ctx.update.message.chat.type);
      // console.log(ctx.update.message);
    });

    bot.launch();

    bot.catch((error) => {
      console.log('------- telegraf error------\n', error);
    });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  async function getYearlyBTCTweet(timeframe = 'yearly') {
    dateNow = new Date();
    nowYear = dateNow.getFullYear();
    nowMonth = dateNow.getMonth() + 1;
    nowDay = dateNow.getDate();
    nowHours = dateNow.getHours();
    errorCounter = 0;
    let flag = false;

    while (1 == 1) {
      try {
        //loop through each year from 2012 to extract the bitcoin price
        if (timeframe == 'yearly') {
          for (let year = initialYear; year < nowYear; year++) {
            let historicDateInit = nowMonth + '-' + nowDay + '-' + year + ' ' + (nowHours - 1) + ':00';
            let historicDateInitTimeStamp = Math.round(+new Date(historicDateInit) / 1000);

            let historicDateEnd = nowMonth + '-' + nowDay + '-' + year + ' ' + nowHours + ':00';
            let historicDateEndTimeStamp = Math.round(+new Date(historicDateEnd) / 1000);

            const ohlc = await bitstampAPI.ohlc(CURRENCY.BTC_USD, historicDateInitTimeStamp, historicDateEndTimeStamp);
            historicPrices[year] = numberWithCommas(Math.floor(ohlc.body.data.ohlc[0].close));
          }
          historicPrices[nowYear] = numberWithCommas(Math.floor((await bitstampAPI.ticker(CURRENCY.BTC_USD)).body.last));
        } else if (timeframe == 'monthly') {
          nowYear--;
          let auxMonth = 0;
          for (let month = nowMonth; month < nowMonth + 12; month++) {
            if (month > 12) {
              auxMonth = month - 12;
              if (!flag) {
                flag = true;
                nowYear++;
              }
            } else {
              auxMonth = month;
            }
            let historicDateInit = auxMonth + '-' + nowDay + '-' + nowYear + ' ' + (nowHours - 1) + ':00';
            let historicDateInitTimeStamp = Math.round(+new Date(historicDateInit) / 1000);

            let historicDateEnd = auxMonth + '-' + nowDay + '-' + nowYear + ' ' + nowHours + ':00';
            let historicDateEndTimeStamp = Math.round(+new Date(historicDateEnd) / 1000);

            const ohlc = await bitstampAPI.ohlc(CURRENCY.BTC_USD, historicDateInitTimeStamp, historicDateEndTimeStamp);
            historicPrices[month] = numberWithCommas(Math.floor(ohlc.body.data.ohlc[0].close));
          }
          historicPrices[nowMonth + 12] = numberWithCommas(Math.floor((await bitstampAPI.ticker(CURRENCY.BTC_USD)).body.last));
        }
        // get last price of the "now moment"

        break;
      } catch (e) {
        console.log('-Error-');
        console.log(e);
        errorCounter++;
        if (errorCounter >= 20) {
          console.log('Too many errors- EXIT');
          process.exit();
        }
        await sleep(1000);
      }
    }

    if (timeframe == 'yearly') {
      //Construct the tweet
      tweet = '#Bitcoin price on ' + getMonth(nowMonth) + ' ' + nowDay + ':\n\n';
      for (let year = nowYear; year >= initialYear; year--) {
        tweet += year + ': $' + historicPrices[year] + '\n';
      }
      tweet += '\n#BitcoinPriceOnThisDay';
    } else if (timeframe == 'monthly') {
      //Construct the tweet
      tweet = '#Bitcoin price on each ' + nowDay + ' over the last year:\n\n';
      // nowYear--;
      flag = false;
      let auxMonth = 0;
      for (let month = nowMonth + 12; month >= nowMonth; month--) {
        if (month > 12) {
          auxMonth = month - 12;
        } else {
          auxMonth = month;
          if (!flag) {
            flag = true;
            nowYear--;
          }
        }
        tweet += getMonth(auxMonth) + ': $' + historicPrices[month] + '\n';
      }
      tweet += '\n#BitcoinPriceOnThisDay';
    }

    return tweet;
  }

  console.log('Start yearlybtc-bot!');
  console.log(new Date());
  console.log('-------');

  checkConfigRun();

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

  await botFunctions();

  schedule.scheduleJob({ hour: 12, minute: 0, second: 0 }, async function () {
    let message = await getYearlyBTCTweet('yearly');
    //   //Tweet
    await twitter.tweets.statusesUpdate({ status: message });

    //   //Telegram Message
    let chats = await getActiveChats();
    for (let chat of chats) bot.telegram.sendMessage(chat.chatID, message);
  });

  schedule.scheduleJob({ hour: 22, minute: 0, second: 0 }, async function () {
    let message = await getYearlyBTCTweet('monthly');
    //Telegram Message
    await twitter.tweets.statusesUpdate({ status: message });

    let chats = await getActiveChats();
    for (let chat of chats) bot.telegram.sendMessage(chat.chatID, message);
  });
})();
