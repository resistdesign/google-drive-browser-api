export default class RetryHandler {
  static getRandomInt_ (min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  interval = 1000;
  maxInterval = 60 * 1000;

  constructor () {
  }

  retry (onRetry) {
    setTimeout(onRetry, this.interval);
    this.interval = this.nextInterval_();
  }

  reset () {
    this.interval = 1000;
  }

  nextInterval_ () {
    const interval = this.interval * 2 + RetryHandler.getRandomInt_(0, 1000);
    return Math.min(interval, this.maxInterval);
  }
}
