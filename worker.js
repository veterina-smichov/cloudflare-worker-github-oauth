addEventListener("fetch", (event) => event.respondWith(handleRequest(event.request)))

const renderBody = (status, content) => {
  // Stringify content for proper escaping in the script
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
        window.addEventListener("message", function(event) {
          // Only send the authorization message after receiving the "authorizing" message
          if (event.data === "authorizing:github") {
            // Send the result back to the opener
            window.opener.postMessage(
              'authorization:github:${status}:${contentStr}',
              event.origin
            )
            // Close this window once the message is sent
            setTimeout(function() {
              window.close()
            }, 1000)
          }
        })
        
        // Send initial message to opener
        window.opener.postMessage("authorizing:github", "*")
      </script>
    </body>
    </html>
  `
  
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Access-Control-Allow-Origin": "*"
    }
  })
}

async function handleRequest(req) {
  const client_id = CLIENT_ID
  const client_secret = CLIENT_SECRET
  
  try {
    const url = new URL(req.url)
    
    // Auth endpoint - redirect to GitHub
    if (url.pathname === "/auth") {
      const redirectUrl = new URL("https://github.com/login/oauth/authorize")
      redirectUrl.searchParams.set("client_id", client_id)
      redirectUrl.searchParams.set("redirect_uri", `${url.origin}/callback`)
      redirectUrl.searchParams.set("scope", "repo user")
      
      // Simple state parameter - we just need it to prevent CSRF
      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      redirectUrl.searchParams.set("state", state)
      return Response.redirect(redirectUrl.href, 301)
    }
    
    // Callback endpoint - handle GitHub response
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code")
      if (!code) {
        return renderBody("error", { error: "No code provided" })
      }
      
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "cloudflare-worker-github-oauth-login",
          "Accept": "application/json"
        },
        body: JSON.stringify({ client_id, client_secret, code })
      })
      
      const result = await response.json()
      console.log("GitHub OAuth response:", result)
      
      if (result.error) {
        console.error("GitHub OAuth error:", result)
        return renderBody("error", result)
      }
      
      const token = result.access_token
      const provider = "github"
      
      // Return success with token
      return renderBody("success", { token, provider })
    }
    
    // Handle root and other paths
    return new Response("GitHub OAuth Provider", {
      headers: { "Content-Type": "text/plain" }
    })
    
  } catch (error) {
    console.error("OAuth Error:", error)
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    })
  }
}