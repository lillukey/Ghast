export default async function handler(req, res) {
  try {
    // Force a mock browser User-Agent header so Neocities allows the fetch
    const response = await fetch('https://gospartans.neocities.org', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).send(`Failed to reach destination. Status: ${response.status}`);
    }

    let html = await response.text();

    // Inject the base tag to fix images and relative styling sheets
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head><base href="https://gospartans.neocities.org/">');
    } else {
      html = `<base href="https://gospartans.neocities.org/">` + html;
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);

  } catch (error) {
    return res.status(500).send(`Server Proxy Error: ${error.message}`);
  }
}
