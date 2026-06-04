export default async function handler(req, res) {
  try {
    // 1. Vercel requests the site in the cloud, completely hidden from your network
    const response = await fetch('https://neocities.org');
    
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch target site`);
    }

    let html = await response.text();

    // 2. Base URL rewriting 
    // This injects a <base> tag so relative links (like images or styles) 
    // on the Neocities site still load correctly inside your app.
    html = html.replace('<head>', '<head><base href="https://neocities.org/">');

    // 3. Send the clean HTML payload back to your browser
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (error) {
    return res.status(500).send(`Server Proxy Error: ${error.message}`);
  }
}
