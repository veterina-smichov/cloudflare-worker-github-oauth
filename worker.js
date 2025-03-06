addEventListener("fetch", (event) => event.respondWith(handleRequest(event.request)))

/**
 * Renders an HTML response that communicates OAuth results back to the opener window
 * @param {string} status - The status of the authorization ('success' or 'error')
 * @param {Object} content - The data to be passed back to the opener window
 * @returns {Response} - HTML response that handles the OAuth flow completion
 */
const renderBody = (status, content) => {
  // Stringify content for proper escaping in the script
  // We need to escape double quotes to avoid breaking the JavaScript string
  const contentStr = JSON.stringify(content).replace(/"/g, '\\"')
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authorizing with GitHub...</title>
    </head>
    <body>
      <h1>Authorizing, please wait...</h1>
      <script>
        // Wait for the opener to be ready
        // This establishes a communication channel with the parent window
        window.addEventListener("message", function(event) {
          // Only send the authorization message after receiving the "authorizing" message
          // This ensures the parent window is ready to receive our response
          if (event.data === "authorizing:github") {
            // Send the result back to the opener with the authorization status and data
            window.opener.postMessage(
              'authorization:github:${status}:${contentStr}',
              event.origin
            )
            // Close this window once the message is sent to complete the OAuth flow
            setTimeout(function() {
              window.close()
            }, 1000)
          }
        })
        
        // Send initial message to opener to indicate we're ready for communication
        window.opener.postMessage("authorizing:github", "*")
      </script>
    </body>
    </html>
  `
  
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Access-Control-Allow-Origin": "*" // Allow cross-origin access to this response
    }
  })
}

/**
 * Main request handler for the GitHub OAuth Worker
 * Handles three primary endpoints:
 * 1. /auth - Initiates the OAuth flow by redirecting to GitHub
 * 2. /callback - Processes the GitHub callback with auth code
 * 3. / (root) - Simple information endpoint
 * 
 * @param {Request} req - The incoming request object
 * @returns {Response} - The appropriate response based on the request path
 */
async function handleRequest(req) {
  // GitHub OAuth application credentials
  // These should be set as environment variables in the Cloudflare dashboard
  const client_id = CLIENT_ID
  const client_secret = CLIENT_SECRET
  
  try {
    const url = new URL(req.url)
    
    // Auth endpoint - redirect to GitHub
    if (url.pathname === "/auth") {
      // Construct the GitHub authorization URL with proper parameters
      const redirectUrl = new URL("https://github.com/login/oauth/authorize")
      redirectUrl.searchParams.set("client_id", client_id)
      redirectUrl.searchParams.set("redirect_uri", `${url.origin}/callback`)
      redirectUrl.searchParams.set("scope", "repo user") // Request access to repos and user info
      
      // Generate a random state parameter to prevent CSRF attacks
      // This creates a 32-character hex string from random bytes
      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      redirectUrl.searchParams.set("state", state)
      return Response.redirect(redirectUrl.href, 301)
    }
    
    // Callback endpoint - handle GitHub response
    if (url.pathname === "/callback") {
      // Extract the authorization code from query parameters
      const code = url.searchParams.get("code")
      if (!code) {
        return renderBody("error", { error: "No code provided" })
      }
      
      // Exchange the code for an access token
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "cloudflare-worker-github-oauth-login",
          "Accept": "application/json" // Request JSON response instead of URL-encoded
        },
        body: JSON.stringify({ client_id, client_secret, code })
      })
      
      const result = await response.json()
      console.log("GitHub OAuth response:", result)
      
      // Handle potential errors from GitHub
      if (result.error) {
        console.error("GitHub OAuth error:", result)
        return renderBody("error", result)
      }
      
      // Extract and prepare the successful response data
      const token = result.access_token
      const provider = "github"
      
      // Return success with token to the opener window
      return renderBody("success", { token, provider })
    }
    
    // Handle root and other paths with a simple informational response
    return new Response("GitHub OAuth Provider", {
      headers: { "Content-Type": "text/plain" }
    })
    
  } catch (error) {
    // Comprehensive error handling for any unexpected issues
    console.error("OAuth Error:", error)
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    })
  }
}
