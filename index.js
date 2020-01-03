const request = require('request-promise-native');
const moment = require('moment');
const _ = require('lodash');

const { OURA_ES_URL, OURA_ES_PASS, OURA_TOKEN } = process.env;

class OuraToES {
   constructor(token) {
      this.ouraToken = token;
   }

   async sendToES(data) {
      await request.put(
         `${OURA_ES_URL}/oura/_doc/${data.eventType.substr(0, 2)}${moment(data.timestamp).unix()}`,
         {
            auth: {
               user: 'token',
               password: OURA_ES_PASS
            },
            json: data,
            timeout: 5 * 1000
         }
      );
      process.stdout.write('.');
   }

   async fetchOuraData() {
      const date = moment();
      const format = 'YYYY-MM-DD';

      const response = await request.get(
         `https://api.ouraring.com/v1/sleep?start=${date
            .subtract(1, 'day')
            .format(format)}&end=${date.format(format)}&access_token=${this.ouraToken}`
      );

      const json = JSON.parse(response);

      const longest = json.sleep.find(sleep => sleep.is_longest === 1);

      this.data = longest;
   }

   parseDuration(seconds) {
      return Number.parseFloat((seconds / 60 / 60).toFixed(2));
   }

   buildSummaryEvent() {
      return _.omit(
         {
            ...this.data,
            timestamp: this.data.bedtime_end,
            rem: this.parseDuration(this.data.rem),
            deep: this.parseDuration(this.data.deep),
            light: this.parseDuration(this.data.light),
            awake: this.parseDuration(this.data.awake),
            duration: this.parseDuration(this.data.bedtime_end_delta),
            eventType: 'sleep_summary'
         },
         [ 'hr_5min', 'rmssd_5min' ]
      );
   }

   buildHrvEvents() {
      const all = this.data.rmssd_5min.map((num, index) => ({
         value: num,
         timestamp: moment(this.data.bedtime_start)
            .add((index + 1) * 5, 'minutes')
            .toISOString(),
         eventType: 'hrv'
      }));

      return all.filter(event => event.value !== 0);
   }

   buildHREvents() {
      const all = this.data.hr_5min.map((num, index) => ({
         value: num,
         timestamp: moment(this.data.bedtime_start)
            .add((index + 1) * 5, 'minutes')
            .toISOString(),
         eventType: 'heart_rate'
      }));

      return all.filter(event => event.value !== 0);
   }

   buildAllEvents() {
      return [ ...[ this.buildSummaryEvent() ], ...this.buildHrvEvents(), ...this.buildHREvents() ];
   }

   async init() {
      console.info('Fetching data from Oura');
      await this.fetchOuraData();

      if (!this.data) {
         console.info('No oura data fetched');
         return;
      }

      console.info('Building events');
      const events = await this.buildAllEvents();

      console.info('Sending to ES');
      for (const event of events) {
         await this.sendToES(event);
      }
   }
}

(async () => {
   const instance = new OuraToES(OURA_TOKEN);
   await instance.init();
})();
