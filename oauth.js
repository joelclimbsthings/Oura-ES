const express = require('express');
const app = express();
const port = 3000;

const { OURA_CLIENT_ID, OURA_CLIENT_SECRET } = process.env;

// Set the configuration settings
const credentials = {
   client: {
      id: OURA_CLIENT_ID,
      secret: OURA_CLIENT_SECRET
   },
   auth: {
      tokenHost: 'https://cloud.ouraring.com'
   }
};

// Initialize the OAuth2 Library
const oauth2 = require('simple-oauth2').create(credentials);

app.get('/', (req, res) => {
   // Authorization oauth2 URI
   const authorizationUri = oauth2.authorizationCode.authorizeURL({
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'email, personal, daily', // also can be an array of multiple scopes, ex. ['<scope1>, '<scope2>', '...']
      state: 'test'
   });

   // Redirect example using Express (see http://expressjs.com/api.html#res.redirect)
   res.redirect(authorizationUri);
});

app.get('/callback', async (req, res) => {
   // Get the access token object (the authorization code is given from the previous step).
   const tokenConfig = {
      code: req.query.code,
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'email, personal, daily' // also can be an array of multiple scopes, ex. ['<scope1>, '<scope2>', '...']
   };

   // Save the access token
   try {
      const result = await oauth2.authorizationCode.getToken(tokenConfig);
      const accessToken = oauth2.accessToken.create(result);
      console.log(`Token: ${JSON.stringify(accessToken)}`);
      res.end(accessToken.token.access_token);
   } catch (error) {
      console.log('Access Token Error', error.message);
   }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
