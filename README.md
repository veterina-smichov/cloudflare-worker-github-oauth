# Cloudflare Worker GitHub OAuth Provider for Decap CMS

A lightweight Cloudflare Worker implementation that handles GitHub OAuth authentication flow. This worker serves as a bridge between your client-side application and GitHub's OAuth service, managing token exchange without requiring a traditional server.

## Features

- **Seamless GitHub OAuth Flow**: Handles the complete OAuth flow including the initial redirect and token exchange
- **Cross-Origin Support**: Works with applications hosted on different domains
- **Secure Communication**: Uses postMessage API for secure communication with the opener window
- **Minimal Dependencies**: Pure JavaScript implementation with no external dependencies
- **CSRF Protection**: Implements state parameter for security against cross-site request forgery

## How It Works

The worker handles three main endpoints:

1. **`/auth`**: Initiates the OAuth process by redirecting to GitHub's authorization page with proper parameters
2. **`/callback`**: Processes GitHub's response, exchanges the authorization code for an access token, and communicates the result back to the opener window
3. **`/`**: Provides basic information about the service

## Setup and Deployment

### Prerequisites

- A Cloudflare account with Workers enabled
- A GitHub OAuth App (create one at GitHub Developer Settings)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

### Configuration

1. **Configure GitHub OAuth App**:
   - Create a new OAuth App in your GitHub Developer Settings
   - Set the Authorization callback URL to `https://your-worker-subdomain.workers.dev/callback`

2. **Set Environment Variables**:
   - Add your GitHub OAuth credentials as environment variables in the Cloudflare dashboard:
     - `CLIENT_ID`: Your GitHub OAuth App Client ID
     - `CLIENT_SECRET`: Your GitHub OAuth App Client Secret

3. **Deploy the Worker**:
   ```bash
   wrangler publish
   ```

## Usage in Client Applications

### Starting the OAuth Flow

```javascript
// Open the authorization window
const authWindow = window.open(
  'https://your-worker-subdomain.workers.dev/auth',
  'GitHub Authorization',
  'width=600,height=800'
);

// Listen for the authorization result
window.addEventListener('message', function(event) {
  if (event.origin !== 'https://your-worker-subdomain.workers.dev') return;
  
  // Parse the authorization message
  const message = event.data;
  if (typeof message === 'string' && message.startsWith('authorization:github:')) {
    const parts = message.split(':');
    const status = parts[2];
    const data = JSON.parse(parts.slice(3).join(':'));
    
    if (status === 'success') {
      // Handle successful authorization
      const token = data.token;
      // Use the token for GitHub API requests
    } else {
      // Handle error
      console.error('Authorization failed:', data.error);
    }
  }
});

// Send an initial message to trigger the communication
authWindow.postMessage('authorizing:github', 'https://your-worker-subdomain.workers.dev');
```

## Security Considerations

- **Token Exposure**: The access token is sent directly to the client application. Ensure your client handles this token securely.
- **HTTPS**: Always use HTTPS to prevent token interception.
- **Client Secret**: The client secret is stored as an environment variable in Cloudflare and is never exposed to the client.
- **State Parameter**: The implementation uses a state parameter to prevent CSRF attacks.

## Limitations

- The worker is designed for client-side applications that need GitHub authentication.
- The implementation does not persist tokens - storage and refresh functionality must be handled by your client application.
- Scope is currently fixed to "repo user" - modify the code if you need different permission scopes.

## Customization

You can customize the worker by:

- Changing the requested OAuth scopes to fit your application's needs
- Modifying the HTML template in the `renderBody` function to match your branding
- Adding additional security measures like checking the state parameter in the callback

## License

[UNLICENSE](LICENSE)
