# Google Drive Browser API

## Install

`npm i -S @resistdesign/google-drive-browser-api`

## Usage

```js
import {
  GoogleSignIn,
  GoogleDrive
} from '@resistdesign/google-drive-browser-api';

const app = async () => {
  const googleSignIn = new GoogleSignIn({
    apiKey: '...',
      clientId: '...',
      scopes: ['...'],
      discoveryDocs: ['...']
  });
  
  // Load the the Google API code.
  await googleSignIn.initialize();
  
  // `getAuthToken` will automatically initiate a sign in prompt to
  // the user if the user is not yet signed in.
  const authToken = await googleSignIn.getAuthToken();
  const {
    gapi: {
      client: {
        drive
      } = {}
    } = {}
  } = googleSignIn;
  const googleDrive = new GoogleDrive({
    authToken,
    drive
  });
  const result = await googleDrive.create(
    {
        mimeType: 'text/plain',
        name: 'My Text Files.txt',
        description: 'The file description.',
        properties: {
            myProperty: 'My Property Value'
        }
    },
    folder
  );
  
  console.log(result);
};

// Run the app.
app();
```
