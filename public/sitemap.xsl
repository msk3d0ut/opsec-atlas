<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>OpsecAtlas · Sitemap</title>
        <style>
          :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #0e100e; color: #d8ddd8; }
          main { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: 56px 0 80px; }
          header { border-bottom: 1px solid #273027; padding-bottom: 24px; margin-bottom: 24px; }
          .kicker { color: #7f9780; text-transform: uppercase; letter-spacing: .16em; font-size: 12px; }
          h1 { margin: 8px 0 8px; font-size: clamp(28px, 5vw, 48px); font-weight: 650; color: #f1f4f1; }
          p { color: #9da89d; line-height: 1.6; margin: 0; }
          .count { color: #7f9780; margin-top: 8px; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #273027; background: #111411; }
          th, td { padding: 13px 14px; text-align: left; border-bottom: 1px solid #202820; vertical-align: top; }
          th { color: #7f9780; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; font-weight: 600; }
          tr:last-child td { border-bottom: 0; }
          tr:hover td { background: #151a15; }
          a { color: #c8d9c9; text-decoration: none; overflow-wrap: anywhere; }
          a:hover { color: #ffffff; text-decoration: underline; text-underline-offset: 3px; }
          .num { width: 72px; color: #667366; }
          .modified { width: 190px; color: #7f897f; }
          footer { margin-top: 24px; color: #5f6b5f; font-size: 12px; }
          @media (max-width: 680px) {
            main { width: min(100% - 24px, 1120px); padding-top: 32px; }
            .modified { display: none; }
            th, td { padding: 11px 10px; }
            .num { width: 52px; }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div class="kicker">machine-readable map</div>
            <h1>OpsecAtlas sitemap</h1>
            <xsl:choose>
              <xsl:when test="s:sitemapindex">
                <p>Sitemap index for the OpsecAtlas public site.</p>
                <div class="count"><xsl:value-of select="count(s:sitemapindex/s:sitemap)" /> sitemap file(s)</div>
              </xsl:when>
              <xsl:otherwise>
                <p>Canonical public URLs exposed to search engines.</p>
                <div class="count"><xsl:value-of select="count(s:urlset/s:url)" /> indexed URL(s)</div>
              </xsl:otherwise>
            </xsl:choose>
          </header>

          <table>
            <thead>
              <tr>
                <th class="num">#</th>
                <th>URL</th>
                <th class="modified">Last modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:sitemapindex/s:sitemap">
                <tr>
                  <td class="num"><xsl:value-of select="position()" /></td>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc" /></a></td>
                  <td class="modified"><xsl:value-of select="s:lastmod" /></td>
                </tr>
              </xsl:for-each>

              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td class="num"><xsl:value-of select="position()" /></td>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc" /></a></td>
                  <td class="modified"><xsl:value-of select="s:lastmod" /></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <footer>Generated automatically at build time · OpsecAtlas</footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
