# Security Headers Configuration

This document outlines the security headers implemented in the PDF Compressor PWA to ensure a secure browsing experience.

## Content Security Policy (CSP)

The Content Security Policy is designed to prevent cross-site scripting (XSS), clickjacking, and other code injection attacks by specifying which sources of content are allowed.

```
default-src 'self' data: 'unsafe-inline' 'unsafe-eval';
connect-src 'self';
font-src 'self' https://fonts.gstatic.com;
frame-src 'self';
img-src 'self' data: https:;
object-src 'none';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
```

### Policy Explanation:

- `default-src 'self'`: All resources must come from the same origin
- `data:`: Allows data URLs for images and other resources
- `'unsafe-inline'`: Allows inline scripts and styles (necessary for some PWA features)
- `'unsafe-eval'`: Allows eval() function (required for some PDF processing libraries)
- `connect-src 'self'`: Only allows connections to the same origin
- `font-src 'self' https://fonts.gstatic.com`: Allows fonts from same origin and Google Fonts
- `frame-src 'self'`: Only allows frames from same origin
- `img-src 'self' data: https:`: Allows images from same origin, data URLs, and HTTPS sources
- `object-src 'none'`: Disallows plugins like Flash
- `script-src 'self' 'unsafe-inline'`: Allows scripts from same origin and inline scripts
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`: Allows styles from same origin, inline styles, and Google Fonts

## X-Frame-Options

```
X-Frame-Options: SAMEORIGIN
```

This header prevents the page from being displayed in a frame, iframe, or object, protecting against clickjacking attacks. Only frames from the same origin are allowed.

## X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

This header prevents the browser from MIME-sniffing the content type, which can prevent certain types of attacks where a file is disguised as a different content type.

## Referrer-Policy

```
Referrer-Policy: no-referrer-when-downgrade
```

This header controls how much referrer information is sent with requests. It sends the full URL as the referrer when navigating from HTTPS to HTTPS, but sends no referrer when navigating from HTTPS to HTTP.

## Additional Security Considerations

1. All resources are served over HTTPS in production
2. Service worker is served with appropriate caching headers
3. Static assets are cached with long-term caching strategies
4. HTML files are served with no-cache headers to ensure fresh content
5. Strict MIME type checking is enforced
6. Frame embedding is restricted to same-origin only

These security headers are implemented in all deployment configurations:
- GitHub Actions workflow
- Docker container with Nginx
- Netlify configuration
- Vercel configuration