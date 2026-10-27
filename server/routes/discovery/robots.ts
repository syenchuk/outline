/**
 * Returns the robots.txt content. Crawlers may fetch share pages, the share
 * sitemap, and attachment redirects; per-page indexing is controlled by the
 * robots meta tag.
 *
 * @param origin the origin of the request, used to build the sitemap URL.
 * @returns the robots.txt content.
 */
export const robotsResponse = (origin: string): string => `
User-agent: *
Allow: /api/shares.sitemap
Allow: /api/attachments.redirect
Disallow: /api/
Disallow: /auth/
Disallow: /oauth/
Disallow: /mcp
Disallow: /sse
Disallow: /realtime
Disallow: /embeds/
Disallow: /settings
Disallow: /search
Disallow: /home
Disallow: /drafts
Disallow: /trash
Disallow: /archive
Disallow: /starred
Disallow: /templates
Disallow: /dashboard
Disallow: /create
Disallow: /logout
Disallow: /desktop-redirect

Sitemap: ${origin}/sitemap.xml
`;
