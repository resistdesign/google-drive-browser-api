import ScriptJS from 'scriptjs';

export default class Service {
  gapiUrl = 'https://apis.google.com/js/api.js';
  apiKey;
  clientId;
  gapi;
  apisLoaded = false;
  clientInitialized = false;
  scopes = [];
  discoveryDocs = [];
  redirectURI = undefined;

  constructor(config = {}) {
    Object.assign(this, config);
  }

  async loadGAPI() {
    return new Promise((res) => {
      if (!!this.gapi) {
        res();
      } else {
        ScriptJS(
          this.gapiUrl,
          () => {
            this.gapi = window.gapi;

            res();
          }
        );
      }
    });
  }

  async loadAPIs() {
    return new Promise((res) => {
      if (this.apisLoaded) {
        res();
      } else {
        this.gapi.load(
          [
            'client',
            'auth2'
          ]
            .join(':'),
          () => {
            this.apisLoaded = true;

            res();
          }
        );
      }
    });
  }

  async initializeClient() {
    return new Promise((res, rej) => {
      if (this.clientInitialized) {
        res();
      } else {
        const {clientId, apiKey, scopes, discoveryDocs} = this;

        this.gapi.client.init({
          apiKey,
          clientId,
          scope: scopes.join(' '),
          discoveryDocs
        }).then(
          () => {
            this.clientInitialized = true;

            res();
          },
          rej
        );
      }
    });
  }

  async initialize() {
    // Load the Google API code.
    await this.loadGAPI();
    // Load the requested APIs.
    await this.loadAPIs();
    // Initialize the Google Client.
    await this.initializeClient();
  }

  isSignedIn() {
    const GoogleAuth = this.gapi.auth2.getAuthInstance();

    return GoogleAuth.isSignedIn.get();
  }

  async signIn() {
    return new Promise(async (res, rej) => {
      if (this.isSignedIn()) {
        res();
      } else {
        const GoogleAuth = this.gapi.auth2.getAuthInstance();
        const {scopes} = this;

        try {
          await GoogleAuth.signIn({
            scope: scopes.join(' '),
            ux_mode: 'redirect',
            redirect_uri: this.redirectURI
          });
          res();
        } catch (error) {
          rej(error);
        }
      }
    });
  }

  async getAuthToken() {
    if (!this.isSignedIn()) {
      await this.signIn();
    }

    const GoogleAuth = this.gapi.auth2.getAuthInstance();
    const {
      access_token: authToken
    } = GoogleAuth.currentUser.get().getAuthResponse();

    return authToken;
  }
}
