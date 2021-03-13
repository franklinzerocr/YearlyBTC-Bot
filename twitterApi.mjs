import { TwitterClient } from 'twitter-api-client';

export function twitterAPI(twitterKeys) {
  return new TwitterClient({
    apiKey: twitterKeys.apiKey,
    apiSecret: twitterKeys.apiSecret,
    accessToken: twitterKeys.accessTokenBot,
    accessTokenSecret: twitterKeys.accessTokenSecretBot,
  });
}
